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
    TEST_VAT_FILE,
    GEM_JOIN_FILE,
    MOCK_TOKEN_FILE,
    DAI_JOIN_FILE
)

from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain

starknet_contract_address = 0x0


###########
# HELPERS #
###########

async def __setup__(
    starknet: StarknetContract,
    user1: StarknetContract
):
    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[
                user1.contract_address,
            ])
    await vat.init(encode("eth")).invoke(user1.contract_address)

    gem = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                encode("GEM"),
            ])
    gemA = await starknet.deploy(
            source=GEM_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                encode("gem"),
                gem.contract_address,
                user1.contract_address
            ])
    await vat.rely(gemA.contract_address).invoke(user1.contract_address)

    dai = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                encode("Dai"),
            ])
    daiA = await starknet.deploy(
            source=DAI_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                dai.contract_address,
                user1.contract_address
            ])

    # await dai.setOwner(daiA.contract_address).invoke().invoke(user1.contract_address)

    defs = SimpleNamespace(
        vat=compile(TEST_VAT_FILE),
        gem_join=compile(GEM_JOIN_FILE),
        mock_token=compile(MOCK_TOKEN_FILE),
        dai_join=compile(DAI_JOIN_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        serialized_contracts=dict(
            vat=serialize_contract(vat, defs.vat.abi),
            gem=serialize_contract(gem, defs.mock_token.abi),
            gemA=serialize_contract(gemA, defs.gem_join.abi),
            dai=serialize_contract(dai, defs.mock_token.abi),
            daiA=serialize_contract(daiA, defs.dai_join.abi),
        ),
    )


@pytest.fixture(scope="module")
async def copyable_deployment_join(
    request,
    ctx_factory
):
    CACHE_KEY = "deployment_join"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.user1)
    res = dill.dumps(val).decode("cp437")
    request.config.cache.set(CACHE_KEY, res)
    return val


@pytest.fixture(scope="module")
async def ctx_factory_join(copyable_deployment_join):
    def make():
        serialized_contracts = copyable_deployment_join.serialized_contracts

        starknet_state = copyable_deployment_join.starknet.state.copy()
        contracts = {
            name: unserialize_contract(starknet_state, serialized_contract)
            for name, serialized_contract in serialized_contracts.items()
        }

        return SimpleNamespace(**contracts)

    return make

@pytest.fixture(scope="function")
def ctx_join(ctx_factory_join):
    ctx = ctx_factory_join()
    return ctx

@pytest.fixture(scope="function")
async def vat(ctx_join) -> StarknetContract:
    return ctx_join.vat

@pytest.fixture(scope="function")
async def gem(ctx_join) -> DeclaredClass:
    return ctx_join.gem

@pytest.fixture(scope="function")
async def gemA(ctx_join) -> StarknetContract:
    return ctx_join.gemA

@pytest.fixture(scope="function")
async def dai(ctx_join) -> DeclaredClass:
    return ctx_join.dai

@pytest.fixture(scope="function")
async def daiA(ctx_join) -> DeclaredClass:
    return ctx_join.daiA


@pytest.fixture(scope="function")
async def cage_success(
    user1: StarknetContract
):
    async def inner(a):
        await a.cage().invoke(user1.contract_address)

    return inner

@pytest.fixture(scope="function")
async def cage_fail(
    user1: StarknetContract
):
    async def inner(a):
        with pytest.raises(StarkException) as err:
            await a.cage().invoke(user1.contract_address)

    return inner

@pytest.fixture(scope="function")
async def join_gem_success(
    user1: StarknetContract,
    gemA: StarknetContract
):
    async def inner(user, wad):
        await gemA.join(user, to_split_uint(wad)).invoke(user1.contract_address)

    return inner

@pytest.fixture(scope="function")
async def join_gem_fail(
    user1: StarknetContract,
    gemA: StarknetContract
):
    async def inner(user, wad):
        with pytest.raises(StarkException) as err:
            await gemA.join(user, to_split_uint(wad)).invoke(user1.contract_address)

    return inner

@pytest.fixture(scope="function")
async def exit_dai_success(
    user1: StarknetContract,
    daiA: StarknetContract
):
    async def inner(user, wad):
        await daiA.exit(user, to_split_uint(wad)).invoke(user1.contract_address)

    return inner

@pytest.fixture(scope="function")
async def exit_dai_fail(
    user1: StarknetContract,
    daiA: StarknetContract
):
    async def inner(user, wad):
        with pytest.raises(StarkException) as err:
            await daiA.exit(user, to_split_uint(wad)).invoke(user1.contract_address)

    return inner

#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_gem_join(
    user1: StarknetContract,
    gem: StarknetContract,
    gemA: StarknetContract,
    vat: StarknetContract,
    join_gem_success,
    join_gem_fail,
    cage_success,
    cage_fail
):
    me = user1.contract_address

    await gem.mint(user1.contract_address, to_split_uint(20*ether)).invoke(me)
    await gem.approve(gemA.contract_address, to_split_uint(20*ether)).invoke(me)

    await join_gem_success(me, 10*ether)
    res = await vat.gem(encode("gem"), me).call()
    assert res.result == (to_split_uint(10*ether),)
    await cage_success(gemA)
    await join_gem_fail(me, 10*ether)
    res = await vat.gem(encode("gem"), me).call()
    assert res.result == (to_split_uint(10*ether),)


@pytest.mark.asyncio
async def test_dai_exit(
    user1: StarknetContract,
    vat: StarknetContract,
    dai: StarknetContract,
    daiA: StarknetContract,
    cage_success,
    exit_dai_success,
    exit_dai_fail
):
    me = user1.contract_address

    await vat.mint(me, to_split_uint(100*ether)).invoke(me)
    await vat.hope(daiA.contract_address).invoke(me)

    await exit_dai_success(me, 40*ether)
    res = await dai.balanceOf(me).call()
    assert res.result == (to_split_uint(40*ether),)
    res = await vat.dai(me).call()
    assert res.result == (rad(60*ether),)
    await cage_success(daiA)
    await exit_dai_fail(me, 40*ether)
    res = await dai.balanceOf(me).call()
    assert res.result == (to_split_uint(40*ether),)
    res = await vat.dai(me).call()
    assert res.result == (rad(60*ether),)


@pytest.mark.asyncio
async def test_dai_exit_join(
    user1: StarknetContract,
    vat: StarknetContract,
    dai: StarknetContract,
    daiA: StarknetContract
):
    me = user1.contract_address

    await vat.mint(me, to_split_uint(100*ether)).invoke(me)
    await vat.hope(daiA.contract_address).invoke(me)

    await daiA.exit(me, to_split_uint(60*ether)).invoke(me)
    await dai.approve(daiA.contract_address, to_split_uint(-1)).invoke(me)
    await daiA.join(me, to_split_uint(30*ether)).invoke(me)

    res = await dai.balanceOf(me).call()
    assert res.result == (to_split_uint(30*ether),)
    res = await vat.dai(me).call()
    assert res.result == (to_split_uint(70*ether),)


@pytest.mark.asyncio
async def test_cage_no_access(
    user1: StarknetContract,
    gemA: StarknetContract,
    daiA: StarknetContract,
    cage_fail
):
    me = user1.contract_address

    await gemA.deny(me).invoke(me)
    await cage_fail(gemA)
    await daiA.deny(me).invoke(me)
    await cage_fail(daiA)
