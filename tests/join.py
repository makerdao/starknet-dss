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
    DAI_JOIN_FILE,
    GEM,
    call
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
    auth: StarknetContract
):
    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[
                auth.contract_address,
            ])
    await vat.init(encode("eth")).invoke(auth.contract_address)

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
                auth.contract_address
            ])
    await vat.rely(gemA.contract_address).invoke(auth.contract_address)

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
                auth.contract_address
            ])

    # await dai.setOwner(daiA.contract_address).invoke().invoke(auth.contract_address)

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
    val = await __setup__(ctx.starknet, ctx.auth)
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
async def try_cage(
    auth: StarknetContract
):
    async def inner(a):
        try:
            await a.cage().invoke(auth.contract_address)
            return True
        except:
            return False
    return inner

@pytest.fixture(scope="function")
async def try_join_gem(
    auth: StarknetContract,
    gemA: StarknetContract
):
    async def inner(user, wad):
        try:
            await gemA.join(user, wad).invoke(auth.contract_address)
            return True
        except:
            return False
    return inner

@pytest.fixture(scope="function")
async def try_exit_dai(
    auth: StarknetContract,
    daiA: StarknetContract
):
    async def inner(user, wad):
        try:
            await daiA.exit(user, wad).invoke(auth.contract_address)
            return True
        except:
            return False
    return inner

#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_gem_join(
    auth: StarknetContract,
    gem: StarknetContract,
    gemA: StarknetContract,
    vat: StarknetContract,
    try_join_gem,
    try_cage
):
    me = auth.contract_address

    await gem.mint(auth.contract_address, ether(20)).invoke(me)
    await gem.approve(gemA.contract_address, ether(20)).invoke(me)

    assert (await try_join_gem(me, ether(10)))
    assert (await call(vat.gem(GEM, me))) == ether(10)
    assert (await try_cage(gemA))
    assert not (await try_join_gem(me, ether(10)))
    assert (await call(vat.gem(GEM, me))) == ether(10)


@pytest.mark.asyncio
async def test_dai_exit(
    auth: StarknetContract,
    vat: StarknetContract,
    dai: StarknetContract,
    daiA: StarknetContract,
    try_cage,
    try_exit_dai
):
    me = auth.contract_address

    await vat.mint(me, ether(100)).invoke(me)
    await vat.hope(daiA.contract_address).invoke(me)

    assert (await try_exit_dai(me, ether(40)))
    assert (await call(dai.balanceOf(me))) == ether(40)
    assert (await call(vat.dai(me))) == rad(60)
    assert (await try_cage(daiA))
    assert not (await try_exit_dai(me, ether(40)))
    assert (await call(dai.balanceOf(me))) == ether(40)
    assert (await call(vat.dai(me))) == rad(60)


@pytest.mark.asyncio
async def test_dai_exit_join(
    auth: StarknetContract,
    vat: StarknetContract,
    dai: StarknetContract,
    daiA: StarknetContract
):
    me = auth.contract_address

    await vat.mint(me, ether(100)).invoke(me)
    await vat.hope(daiA.contract_address).invoke(me)

    await daiA.exit(me, ether(60)).invoke(me)

    await dai.approve(daiA.contract_address, MAX).invoke(me)
    await daiA.join(me, ether(30)).invoke(me)

    assert (await call(dai.balanceOf(me))) == ether(30)
    assert (await call(vat.dai(me))) == rad(70)


@pytest.mark.asyncio
async def test_cage_no_access(
    auth: StarknetContract,
    gemA: StarknetContract,
    daiA: StarknetContract,
    try_cage
):
    me = auth.contract_address

    await gemA.deny(me).invoke(me)
    assert not (await try_cage(gemA))
    await daiA.deny(me).invoke(me)
    assert not (await try_cage(daiA))
