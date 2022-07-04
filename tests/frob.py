import pytest
import dill
from types import SimpleNamespace

from starkware.starknet.testing.starknet import Starknet, DeclaredClass
from starkware.starknet.testing.contract import StarknetContract
from starkware.starkware_utils.error_handling import StarkException
from starkware.starknet.definitions.error_codes import StarknetErrorCode
from conftest import (
    to_split_uint,
    to_split_uint_neg,
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
    TEST_VAT_FILE,
    GEM_JOIN_FILE,
    MOCK_TOKEN_FILE,
    USR_FILE
)

from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain

starknet_contract_address = 0x0


###########
# HELPERS #
###########

async def __setup__(
    starknet: Starknet,
    user1: StarknetContract
):
    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[
                user1.contract_address,
            ])
    gold = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                encode("GEM"),
            ])
    await gold.mint(user1.contract_address, to_split_uint(1000*ether)).invoke(user1.contract_address)

    await vat.init(encode("gold")).invoke(user1.contract_address)
    gemA = await starknet.deploy(
            source=GEM_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                encode("gold"),
                gold.contract_address,
                user1.contract_address
            ])

    await vat.file_ilk(encode("gold"), encode("spot"), ray(1*ether)).invoke(user1.contract_address)
    await vat.file_ilk(encode("gold"), encode("line"), rad(1000*ether)).invoke(user1.contract_address)
    await vat.file(encode("Line"), rad(1000*ether)).invoke(user1.contract_address)
    '''
    jug = await starknet.deploy(
            source=JUG_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    await jug.init(encode("gold")).invoke(user1.contract_address)
    await vat.rely(jug.contract_address).invoke(user1.contract_address)
    '''

    await gold.approve(gemA.contract_address, to_split_uint(MAX)).invoke(user1.contract_address)
    await gold.approve(vat.contract_address, to_split_uint(MAX)).invoke(user1.contract_address)

    await vat.rely(vat.contract_address).invoke(user1.contract_address)
    await vat.rely(gemA.contract_address).invoke(user1.contract_address)

    await gemA.join(user1.contract_address, to_split_uint(1000*ether)).invoke(user1.contract_address)

    ali = await starknet.deploy(
            source=USR_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    bob = await starknet.deploy(
            source=USR_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    che = await starknet.deploy(
            source=USR_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])

    defs = SimpleNamespace(
        vat=compile(TEST_VAT_FILE),
        gem_join=compile(GEM_JOIN_FILE),
        mock_token=compile(MOCK_TOKEN_FILE),
        usr=compile(USR_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        serialized_contracts=dict(
            vat=serialize_contract(vat, defs.vat.abi),
            gold=serialize_contract(gold, defs.mock_token.abi),
            gemA=serialize_contract(gemA, defs.gem_join.abi),
            ali=serialize_contract(ali, defs.usr.abi),
            bob=serialize_contract(bob, defs.usr.abi),
            che=serialize_contract(che, defs.usr.abi),
        ),
    )

@pytest.fixture(scope="module")
async def copyable_deployment_frob(
    request,
    ctx_factory
):
    CACHE_KEY = "deployment_frob"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.user1)
    res = dill.dumps(val).decode("cp437")
    request.config.cache.set(CACHE_KEY, res)
    return val

@pytest.fixture(scope="module")
async def ctx_factory_frob(copyable_deployment_frob):
    def make():
        serialized_contracts = copyable_deployment_frob.serialized_contracts

        starknet_state = copyable_deployment_frob.starknet.state.copy()
        contracts = {
            name: unserialize_contract(starknet_state, serialized_contract)
            for name, serialized_contract in serialized_contracts.items()
        }

        return SimpleNamespace(**contracts)

    return make

@pytest.fixture(scope="function")
def ctx_frob(ctx_factory_frob):
    ctx = ctx_factory_frob()
    return ctx

@pytest.fixture(scope="function")
async def vat(ctx_frob) -> StarknetContract:
    return ctx_frob.vat

@pytest.fixture(scope="function")
async def gold(ctx_frob) -> DeclaredClass:
    return ctx_frob.gold

@pytest.fixture(scope="function")
async def gemA(ctx_frob) -> StarknetContract:
    return ctx_frob.gemA

@pytest.fixture(scope="function")
async def ali(ctx_frob) -> StarknetContract:
    return ctx_frob.ali

@pytest.fixture(scope="function")
async def bob(ctx_frob) -> StarknetContract:
    return ctx_frob.bob

@pytest.fixture(scope="function")
async def che(ctx_frob) -> StarknetContract:
    return ctx_frob.che


#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_setup(
    user1: StarknetContract,
    vat: StarknetContract,
    gemA: StarknetContract,
    gold: StarknetContract
):
    await check_balance(gold, gemA, 1000*ether)

    gem = await vat.gem(encode("gold"), user1.contract_address).call()
    assert gem.result == (to_split_uint(1000*ether),)


@pytest.mark.asyncio
async def test_join(
    user1: StarknetContract,
    gemA: StarknetContract,
    gold: StarknetContract
):
    await gold.mint(user1.contract_address, to_split_uint(500*ether)).invoke(user1.contract_address)
    await check_balance(gold, user1, 500*ether)
    await check_balance(gold, gemA, 1000*ether)

    await gemA.join(user1.contract_address, to_split_uint(500*ether)).invoke(user1.contract_address)
    await check_balance(gold, user1,         0)
    await check_balance(gold, gemA, 1500*ether)

    await gemA.exit(user1.contract_address, to_split_uint(250*ether)).invoke(user1.contract_address)
    await check_balance(gold, user1, 250*ether)
    await check_balance(gold, gemA, 1250*ether)


@pytest.mark.asyncio
async def test_lock(
    user1: StarknetContract,
    vat: StarknetContract
):
    me = user1.contract_address

    ink = await vat.ink(encode("gold"), me).call()
    assert ink.result == (to_split_uint(0),)
    gem = await vat.gem(encode("gold"), me).call()
    assert gem.result == (to_split_uint(1000*ether),)

    await vat.frob(encode("gold"), me, me, me, to_split_uint(6*ether), to_split_uint(0)).invoke(me)
    ink = await vat.ink(encode("gold"), me).call()
    assert ink.result == (to_split_uint(6*ether),)
    gem = await vat.gem(encode("gold"), me).call()
    assert gem.result == (to_split_uint(994*ether),)

    await vat.frob(encode("gold"), me, me, me, to_split_uint_neg(-6*ether), to_split_uint(0)).invoke(me)
    ink = await vat.ink(encode("gold"), me).call()
    assert ink.result == (to_split_uint(0),)
    gem = await vat.gem(encode("gold"), me).call()
    assert gem.result == (to_split_uint(1000*ether),)


@pytest.fixture(scope="function")
async def frob_success(
    vat: StarknetContract,
    user1: StarknetContract,
):
    me = user1.contract_address

    async def inner(ilk, ink, art):
        if (ink >= 0):
            _ink = to_split_uint(ink)
        else:
            _ink = to_split_uint_neg(ink)
        if (art >= 0):
            _art = to_split_uint(art)
        else:
            _art = to_split_uint_neg(art)
        await vat.frob(ilk, me, me, me, _ink, _art).invoke(me)

    return inner


@pytest.fixture(scope="function")
async def frob_fail(
    vat: StarknetContract,
    user1: StarknetContract,
):
    me = user1.contract_address

    async def inner(ilk, ink, art):
        if (ink >= 0):
            _ink = to_split_uint(ink)
        else:
            _ink = to_split_uint_neg(ink)
        if (art >= 0):
            _art = to_split_uint(art)
        else:
            _art = to_split_uint_neg(art)
        with pytest.raises(StarkException) as err:
            await vat.frob(ilk, me, me, me, _ink, _art).invoke(me)

    return inner


@pytest.mark.asyncio
async def test_calm(
    user1: StarknetContract,
    vat: StarknetContract,
    frob_success,
    frob_fail
):
    await vat.file_ilk(encode("gold"), encode("line"), rad(10*ether)).invoke(user1.contract_address)
    await frob_success(encode("gold"), 10*ether, 9*ether)
    await frob_fail(encode("gold"),           0, 2*ether)


@pytest.mark.asyncio
async def test_cool(
    user1: StarknetContract,
    vat: StarknetContract,
    frob_success
):
    await vat.file_ilk(encode("gold"), encode("line"), rad(10*ether)).invoke(user1.contract_address)
    await frob_success(encode("gold"), 10*ether, 8*ether)
    await vat.file_ilk(encode("gold"), encode("line"), rad(5*ether)).invoke(user1.contract_address)
    await frob_success(encode("gold"), 0, -1*ether)


@pytest.mark.asyncio
async def test_safe(
    user1: StarknetContract,
    vat: StarknetContract,
    frob_fail
):
    me = user1.contract_address
    await vat.frob(encode("gold"), me, me, me, to_split_uint(10*ether), to_split_uint(5*ether)).invoke(user1.contract_address)
    await frob_fail(encode("gold"), 0, 6*ether)


@pytest.mark.asyncio
async def test_nice(
    user1: StarknetContract,
    vat: StarknetContract,
    frob_success,
    frob_fail
):
    me = user1.contract_address
    await vat.frob(encode("gold"), me, me, me, to_split_uint(10*ether), to_split_uint(10*ether)).invoke(me)
    await vat.file_ilk(encode("gold"), encode("spot"), ray(0.5*ether)).invoke(me)

    await frob_fail(encode("gold"),          0,  1*ether)
    await frob_success(encode("gold"),       0, -1*ether)
    await frob_fail(encode("gold"),   -1*ether,        0)
    await frob_success(encode("gold"), 1*ether,        0)

    await frob_fail(encode("gold"), -2*ether, -4*ether)
    await frob_fail(encode("gold"),  5*ether,  1*ether)

    await frob_success(encode("gold"), -1*ether, -4*ether)
    await vat.file_ilk(encode("gold"), encode("spot"), ray(0.4*ether)).invoke(me)
    await frob_success(encode("gold"),  5*ether,  1*ether)

@pytest.fixture(scope="function")
async def can_frob_true(
    user1: StarknetContract,
):
    async def inner(contract, a, b, c, d, e):
        if (d < 0):
            _d = to_split_uint_neg(d)
        else:
            _d = to_split_uint(d)
        if (e < 0):
            _e = to_split_uint_neg(e)
        else:
            _e = to_split_uint(e)
        await contract.can_frob(encode("gold"), a, b, c, _d, _e).invoke(user1.contract_address)
    return inner

@pytest.fixture(scope="function")
async def can_frob_false(
    user1: StarknetContract,
):
    async def inner(contract, a, b, c, d, e):
        if (d < 0):
            _d = to_split_uint_neg(d)
        else:
            _d = to_split_uint(d)
        if (e < 0):
            _e = to_split_uint_neg(e)
        else:
            _e = to_split_uint(e)
        with pytest.raises(StarkException):
            await contract.can_frob(encode("gold"), a, b, c, _d, _e).invoke(user1.contract_address)
    return inner


@pytest.mark.asyncio
async def test_alt_callers(
    starknet: Starknet,
    user1: StarknetContract,
    vat: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    can_frob_true,
    can_frob_false
):
    me = user1.contract_address

    a = ali.contract_address
    b = bob.contract_address
    c = che.contract_address

    await vat.slip(encode("gold"), a, rad(20*ether)).invoke(me)
    await vat.slip(encode("gold"), b, rad(20*ether)).invoke(me)
    await vat.slip(encode("gold"), c, rad(20*ether)).invoke(me)

    await ali.frob(encode("gold"), a, a, a, to_split_uint(10*ether), to_split_uint(5*ether)).invoke(me)

    # anyone can lock
    await can_frob_true(ali, a, a, a, 1*ether, 0)
    await can_frob_true(bob, a, b, b, 1*ether, 0)
    await can_frob_true(che, a, c, c, 1*ether, 0)
    # but only with their own gems
    await can_frob_false(ali, a, b, a, 1*ether, 0)
    await can_frob_false(bob, a, c, b, 1*ether, 0)
    await can_frob_false(che, a, a, c, 1*ether, 0)

    # only the lad can free
    await can_frob_true(ali, a, a, a,  -1*ether, 0)
    await can_frob_false(bob, a, b, b, -1*ether, 0)
    await can_frob_false(che, a, c, c, -1*ether, 0)
    # the lad can free the anywhere
    await can_frob_true(ali, a, b, a, -1*ether, 0)
    await can_frob_true(ali, a, c, a, -1*ether, 0)

    # only the lad can draw
    await can_frob_true(ali, a, a, a, 0, 1*ether)
    await can_frob_false(bob, a, b, b, 0, 1*ether)
    await can_frob_false(che, a, c, c, 0, 1*ether)
    # the lad can draw to anywhere
    await can_frob_true(ali, a, a, b, 0, 1*ether)
    await can_frob_true(ali, a, a, c, 0, 1*ether)

    await vat.mint(b, to_split_uint(1*ether)).invoke(me)
    await vat.mint(c, to_split_uint(1*ether)).invoke(me)

    # anyone can wipe
    await can_frob_true(ali, a, a, a, 0, -1*ether)
    await can_frob_true(bob, a, b, b, 0, -1*ether)
    await can_frob_true(che, a, c, c, 0, -1*ether)
    # but only with their own dai
    await can_frob_false(ali, a, a, b, 0, -1*ether)
    await can_frob_false(bob, a, b, c, 0, -1*ether)
    await can_frob_false(che, a, c, a, 0, -1*ether)


@pytest.mark.asyncio
async def test_hope(
    starknet: Starknet,
    user1: StarknetContract,
    vat: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    can_frob_true,
    can_frob_false
):
    me = user1.contract_address

    a = ali.contract_address
    b = bob.contract_address
    c = che.contract_address

    await vat.slip(encode("gold"), a, rad(20*ether)).invoke(me)
    await vat.slip(encode("gold"), b, rad(20*ether)).invoke(me)
    await vat.slip(encode("gold"), c, rad(20*ether)).invoke(me)

    await ali.frob(encode("gold"), a, a, a, to_split_uint(10*ether), to_split_uint(5*ether)).invoke(me)

    await can_frob_true(ali, a, a, a, 0, 1*ether)
    await can_frob_false(bob, a, b, b, 0, 1*ether)
    await can_frob_false(che, a, c, c, 0, 1*ether)

    await ali.hope(b).invoke(me)

    await can_frob_true(ali, a, a, a, 0, 1*ether)
    await can_frob_true(bob, a, b, b, 0, 1*ether)
    await can_frob_false(che, a, c, c, 0, 1*ether)


@pytest.mark.asyncio
async def test_dust(
    user1: StarknetContract,
    vat: StarknetContract,
    frob_success,
    frob_fail
):
    me = user1.contract_address
    await frob_success(encode("gold"), 9*ether, 1*ether)
    await vat.file_ilk(encode("gold"), encode("dust"), rad(5*ether)).invoke(me)
    await frob_fail(encode("gold"),    5*ether, 2*ether)
    await frob_success(encode("gold"), 0,       5*ether)
    await frob_fail(encode("gold"),    0,      -5*ether)
    await frob_success(encode("gold"), 0,      -6*ether)
