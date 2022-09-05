import pytest
import dill
from types import SimpleNamespace

from starkware.starknet.testing.starknet import Starknet, DeclaredClass
from starkware.starknet.testing.contract import StarknetContract
from conftest import (
    encode,
    compile,
    serialize_contract,
    unserialize_contract,
    ray,
    rad,
    wad,
    MAX,
    TEST_VAT_FILE,
    GEM_JOIN_FILE,
    MOCK_TOKEN_FILE,
    DAI_JOIN_FILE,
    GEM,
    call,
    invoke
)

# Based on: https://github.com/makerdao/xdomain-dss/blob/f447e779576942cf983c00ee8b9dafa937d2427f/src/test/Vat.t.sol

#########
# SETUP #
#########
async def __setup__(starknet, me):
    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[
                me
            ])
    await invoke(me, vat.init(encode("eth")))

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
                me
            ])
    await invoke(me, vat.rely(gemA.contract_address))

    dai = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                encode("Dai"),
            ])
    daiA = await starknet.deploy(
            source=DAI_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                dai.contract_address
            ])

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
    val = await __setup__(ctx.starknet, ctx.me)
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


#########
# STATE #
#########
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


###########
# HELPERS #
###########
@pytest.fixture(scope="function")
async def try_cage(me):
    async def inner(a):
        try:
            await invoke(me, a.cage())
            return True
        except:
            return False
    return inner

@pytest.fixture(scope="function")
async def try_join_gem(me, gemA):
    async def inner(user, wad):
        try:
            await invoke(me, gemA.join(user, wad))
            return True
        except:
            return False
    return inner

@pytest.fixture(scope="function")
async def try_exit_dai(me, daiA):
    async def inner(user, wad):
        try:
            await invoke(me, daiA.exit(user, wad))
            return True
        except:
            return False
    return inner


#########
# TESTS #
#########
# https://github.com/makerdao/xdomain-dss/blob/f447e779576942cf983c00ee8b9dafa937d2427f/src/test/Vat.t.sol#L329
@pytest.mark.asyncio
async def test_gem_join(me, gem, gemA, vat, try_join_gem, try_cage):
    await invoke(me, gem.mint(me, wad(20)))
    await invoke(me, gem.approve(gemA.contract_address, wad(20)))

    assert (await try_join_gem(me, wad(10)))
    assert (await call(vat.gem(GEM, me))) == wad(10)
    assert (await try_cage(gemA))
    assert not (await try_join_gem(me, wad(10)))
    assert (await call(vat.gem(GEM, me))) == wad(10)

# https://github.com/makerdao/xdomain-dss/blob/f447e779576942cf983c00ee8b9dafa937d2427f/src/test/Vat.t.sol#L349
@pytest.mark.asyncio
async def test_dai_exit_join(me, vat, dai, daiA):
    await invoke(me, vat.mint(me, wad(100)))
    await invoke(me, vat.hope(daiA.contract_address))

    await invoke(me, daiA.exit(me, wad(60)))

    await invoke(me, dai.approve(daiA.contract_address, MAX))
    await invoke(me, daiA.join(me, wad(30)))

    assert (await call(dai.balanceOf(me))) == wad(30)
    assert (await call(vat.dai(me))) == rad(70)

# https://github.com/makerdao/xdomain-dss/blob/f447e779576942cf983c00ee8b9dafa937d2427f/src/test/Vat.t.sol#L359
@pytest.mark.asyncio
async def test_cage_no_access(me, gemA, daiA, try_cage):
    await invoke(me, gemA.deny(me))
    assert not (await try_cage(gemA))
