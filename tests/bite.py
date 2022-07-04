import pytest
import dill
from types import SimpleNamespace

from starkware.starknet.testing.starknet import Starknet, DeclaredClass
from starkware.starknet.testing.contract import StarknetContract
from starkware.starkware_utils.error_handling import StarkException
from starkware.starknet.definitions.error_codes import StarknetErrorCode
from conftest import (
    to_split_uint,
    to_uint,
    encode,
    compile,
    serialize_contract,
    unserialize_contract,
    check_balance,
    ray,
    rad,
    ether,
    MAX,
    HEVM_FILE,
    MOCK_TOKEN_FILE,
    TEST_VAT_FILE,
    FLAPPER_FILE,
    FLOPPER_FILE,
    FLIPPER_FILE,
    TEST_VOW_FILE,
    JUG_FILE,
    CAT_FILE,
    GEM_JOIN_FILE,
)

from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain

MLN = 10**6

###########
# HELPERS #
###########

async def __setup__(
    starknet: StarknetContract,
    user1: StarknetContract
):
    hevm = await starknet.deploy(
            source=HEVM_FILE,
            constructor_calldata=[
                0x7109709ECfa91a80626fF3989D68f67F5b1DD12D
            ])
    await hevm.warp(604411200)

    gov = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                encode("GOV")
            ])
    await gov.mint(to_split_uint(100*ether)).invoke(user1.contract_address)

    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[])

    flap = await starknet.deploy(
            source=FLAPPER_FILE,
            constructor_calldata=[
                vat.contract_address,
                gov.contract_address
            ])
    flop = await starknet.deploy(
            source=FLOPPER_FILE,
            constructor_calldata=[
                vat.contract_address,
                gov.contract_address
            ])

    vow = await starknet.deploy(
            source=TEST_VOW_FILE,
            constructor_calldata=[
                vat.contract_address,
                flap.contract_address,
                flop.contract_address
            ])
    await flap.rely(vow.contract_address).invoke(user1.contract_address)
    await flop.rely(vow.contract_address).invoke(user1.contract_address)
    await flap.file(encode("lid"), rad(1000*ether)).invoke(user1.contract_address)

    jug = await starknet.deploy(
            source=JUG_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    await jug.init(encode("gold")).invoke(user1.contract_address)
    await jug.file(encode("vow"), vow.contract_address).invoke(user1.contract_address)
    await vat.rely(jug.contract_address).invoke(user1.contract_address)

    cat = await starknet.deploy(
            source=CAT_FILE,
            constructor_calldata=[
                vow.contract_address
            ])
    await cat.file(encode("vow"), vow.contract_address).invoke(user1.contract_address)
    await cat.file(encode("box"), rad(10*ether*MLN)).invoke(user1.contract_address)
    await vat.rely(cat.contract_address).invoke(user1.contract_address)
    await vow.rely(cat.contract_address).invoke(user1.contract_address)

    gold = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                encode("GEM")
            ])
    await gold.mint(to_split_uint(1000*ether)).invoke(user1.contract_address)

    await vat.init(encode("gold")).invoke(user1.contract_address)
    gemA = await starknet.deploy(
            source=GEM_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                encode("gold"),
                gold.contract_address,
                user1.contract_address
            ])
    await vat.rely(gemA.contract_address).invoke(user1.contract_address)
    await gold.approve(gemA.contract_address).invoke(user1.contract_address)
    await gemA.join(user1.contract_address, to_split_uint(1000*ether)).invoke(user1.contract_address)

    await vat.file_ilk(encode("gold"), encode("spot"), ray(1*ether)).invoke(user1.contract_address)
    await vat.file_ilk(encode("gold"), encode("line"), rad(1000*ether)).invoke(user1.contract_address)
    await vat.file(encode("Line"), rad(1000*ether)).invoke(user1.contract_address)

    flip = await starknet.deploy(
        source=FLIPPER_FILE,
        constructor_calldata=[
            vat.contract_address,
            cat.contract_address,
            encode("gold")
        ])
    await flip.rely(cat.contract_address).invoke(user1.contract_address)
    await cat.rely(flip.contract_address).invoke(user1.contract_address)
    await cat.file(encode("gold"), encode("flip"), flip.contract_address).invoke(user1.contract_address)
    await cat.file(encode("gold"), encode("chop"), to_split_uint(1*ether)).invoke(user1.contract_address)

    await vat.rely(flip.contract_address).invoke(user1.contract_address)
    await vat.rely(flap.contract_address).invoke(user1.contract_address)
    await vat.rely(flop.contract_address).invoke(user1.contract_address)

    await vat.hope(flip.contract_address).invoke(user1.contract_address)
    await vat.hope(flop.contract_address).invoke(user1.contract_address)
    await gold.approve(vat.contract_address).invoke(user1.contract_address)
    await gov.approve(flap.contract_address).invoke(user1.contract_address)

    defs = SimpleNamespace(
        hevm=compile(HEVM_FILE),
        mock_token=compile(MOCK_TOKEN_FILE),
        test_vat=compile(TEST_VAT_FILE),
        flapper=compile(FLAPPER_FILE),
        flopper=compile(FLOPPER_FILE),
        flipper=compile(FLIPPER_FILE),
        test_vow=compile(TEST_VOW_FILE),
        jug=compile(JUG_FILE),
        cat=compile(CAT_FILE),
        gem_join=compile(GEM_JOIN_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        serialized_contracts=dict(
            hevm=serialized_contract(hevm, defs.hevm.abi),
            gov=serialized_contract(gov, defs.mock_token.abi),
            vat=serialized_contract(vat, defs.test_vat.abi),
            flap=serialized_contracts(flap, defs.flapper.abi),
            flop=serialized_contracts(flop, defs.flopper.abi),
            vow=serialized_contracts(vow, defs.test_vow.abi),
            jug=serialized_contracts(jug, defs.jug.abi),
            cat=serialized_contracts(cat, defs.cat.abi),
            gold=serialized_contracts(gold, defs.mock_token.abi),
            gemA=serialized_contracts(gemA, defs.gem_join.abi),
            flip=serialized_contracts(flip, defs.flip.abi)
        ),
    )


@pytest.fixture(scope="module")
async def copyable_deployment_bite(
    request,
    ctx_factory
):
    CACHE_KEY = "deployment_bite"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.user1)
    res = dill.dumps(val).decode("cp437")
    request.config.cache.set(CACHE_KEY, res)
    return val


@pytest.fixture(scope="module")
async def ctx_factory_bite(copyable_deployment_bite):
    def make():
        serialized_contracts = copyable_deployment_bite.serialized_contracts

        starknet_state = copyable_deployment_bite.starknet.state.copy()
        contracts = {
            name: unserialize_contract(starknet_state, serialized_contract)
            for name, serialized_contract in serialized_contracts.items()
        }

        return SimpleNamespace(**contracts)

    return make

@pytest.fixture(scope="function")
def ctx_bite(ctx_factory_bite):
    ctx = ctx_factory_bite()
    return ctx

@pytest.fixture(scope="function")
async def hevm(ctx_bite) -> StarknetContract:
    return ctx_bite.hevm

@pytest.fixture(scope="function")
async def gov(ctx_bite) -> StarknetContract:
    return ctx_bite.gov

@pytest.fixture(scope="function")
async def vat(ctx_bite) -> DeclaredClass:
    return ctx_bite.vat

@pytest.fixture(scope="function")
async def flap(ctx_bite) -> StarknetContract:
    return ctx_bite.flap

@pytest.fixture(scope="function")
async def flop(ctx_bite) -> DeclaredClass:
    return ctx_bite.flop

@pytest.fixture(scope="function")
async def vow(ctx_bite) -> DeclaredClass:
    return ctx_bite.vow

@pytest.fixture(scope="function")
async def jug(ctx_bite) -> DeclaredClass:
    return ctx_bite.jug

@pytest.fixture(scope="function")
async def cat(ctx_bite) -> DeclaredClass:
    return ctx_bite.cat

@pytest.fixture(scope="function")
async def gold(ctx_bite) -> DeclaredClass:
    return ctx_bite.gold

@pytest.fixture(scope="function")
async def gemA(ctx_bite) -> DeclaredClass:
    return ctx_bite.gemA

@pytest.fixture(scope="function")
async def flip(ctx_bite) -> DeclaredClass:
    return ctx_bite.flip

#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_set_dunk_multiple_ilks(
    cat: StarknetContract,
):
    await cat.file_ilk(encode("gold"), encode("dunk"), rad(111111*ether)).invoke(user1.contract_address)
    res = await cat.ilks(encode("gold")).call()
    gold_dunk = res.result[2]
    assert gold_dunk == (rad(111111*ether),)
    await cat.file_ilk(encode("silver"), encode("dunk"), rad(222222*ether)).invoke(user1.contract_address)
    res = await cat.ilks(encode("silver")).call()
    silver_dunk = res.result[2]
    await silver_dunk == (rad(222222*ether),)


@pytest.mark.asyncio
async def test_cat_set_box(
    cat: StarknetContract,
):
    res = await cat.box().call()
    assert res.result == (rad(10*ether*MLN),)
    res = await cat.box().call()
    assert res.result == (rad(20*ether*MLN),)


@pytest.mark.asyncio
async def test_bite_under_dunk(
    cat: StarknetContract,
    vat: StarknetContract,
):
    await vat.file_ilk(encode("gold"), encode("spot"), ray(2.5*ether)).invoke(user1.contract_address)
    await vat.frob(encode("gold"), user1.contract_address, user1.contract_address, user1.contract_address, to_split_uint(40*ether), to_split_uint(100*ether)).invoke(user1.contract_address)
    await vat.file_ilk(encode("gold"), encode("spot"), ray(2*ether)).invoke(user1.contract_address)
    await vat.file_ilk(encode("gold"), encode("dunk"), rad(111*ether)).invoke(user1.contract_address)

    await cat.file_ilk(encode("gold"), encode("dunk"), rad(111*ether)).invoke(user1.contract_address)
    await cat.file_ilk(encode("gold"), encode("chop"), to_split_uint(1.1*ether)).invoke(user1.contract_address)

    res = await cat.bite(encode("gold"), user1.contract_address).invoke(user1.contract_address)
    (auction,) = res.result

@pytest.fixture(scope="function")
async def gem(
    vat: StarknetContract
):
    async def inner(ilk, urn):
        res = await vat.gem(ilk, urn).call()
        return res.result[0]
    return inner

@pytest.fixture(scope="function")
async def ink(
    vat: StarknetContract
):
    async def inner(ilk, urn):
        res = await vat.urns(ilk, urn).call()
        return res.result[0]
    return inner

@pytest.fixture(scope="function")
async def art(
    vat: StarknetContract
):
    async def inner(ilk, urn):
        res = await vat.urns(ilk, urn).call()
        return res.result[1]
    return inner

@pytest.mark.asyncio
async def test_happy_bite(
    vat: StarknetContract,
    cat: StarknetContract,
):
    me = user1.contract_address

    await vat.file_ilk(encode("gold"), encode("spot"), ray(2.5*ether)).invoke(me)
    await vat.frob(encode("gold"), me, me, me, to_split_uint(40*ether), to_split_uint(100*ether)).invoke(me)
    # tag=4, mat=2
    await vat.file_ilk(encode("gold"), encode("spot"), ray(2*ether)).invoke(me)

    await cat.file_ilk(encode("gold"), encode("chop"), ray(1.1*ether)).invoke(me)
    await cat.file_ilk(encode("gold"), encode("dunk"), rad(82.5*ether)).invoke(me)

    auction = await cat.bite(encode("gold"), me).invoke(me)
    res = await ink(encode("gold"), me)
    assert res == to_split_uint(40*ether)
    res = await art(encode("gold"), me)
    assert res == to_split_uint(100*ether)
    res = await vow.Woe().call()
    assert res.result == (to_split_uint(0),)
    res = await gem(encode("gold"), me)
    assert res == to_split_uint(960*ether)

    await cat.file_ilk(encode("gold"), encode("dunk"), rad(200*ether)).invoke(me)
    res = await cat.litter().call()
    assert res.result == (to_split_uint(0),)
    auction = await res.bite(encode("gold"), me).call()
    res = await cat.litter().call()
    assert res.result == (rad(110*ether),)
    res = await ink(encode("gold"), me)
    assert res == to_split_uint(0)
    res = await art(encode("gold"), me)
    assert res == to_split_uint(0)
    res = await vow.sin(now).call()
    assert res.result == (rad(100*ether),)
    res = await gem(encode("gold"), me)
    assert res == to_split_uint(960*ether)

    res = await vat.dai(vow.contract_address).call()
    assert res.result == (rad(0),)
    await vat.mint(me, to_split_uint(100*ether)).invoke(me)
    await flip.tend(auction, to_split_uint(40*ether), rad(1*ether)).invoke(me)
    await flip.tend(auction, to_split_uint(40*ether), rad(110*ether)).invoke(me)

    res = await vat.dai(me).call()
    assert res.result == (to_split_uint(90*ether),)
    res = await gem(encode("gold"), me)
    assert res == to_split_split(960*ether)
    await flip.dent(auction, to_split_uint(38*ether), rad(110*ether)).invoke(me)
    res = await vat.dai(me).call()
    assert res.result ==  (rad(90*ether),)
    res = await gem(encode("gold"), me)
    assert res == to_split_uint(962*ether)
    res = await vow.sin(now).call()
    assert res.result == (rad(100*ether),)

    await hevm.warp(now + 4*hours).invoke(me)
    res = await cat.litter().call()
    assert res.result == (rad(110*ether),)
    await flip.deal(auction).invoke(me)
    res = await cat.litter().call()
    assert res.result == (to_split_uint(0),)
    res = await vat.dai(vow.contract_address).call()
    assert res.result == (rad(110*ether),)
