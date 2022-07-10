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
    GEMS,
    SPOT,
    DUST,
    line,
    Line,
    invoke
)


#########
# SETUP #
#########
async def __setup__(starknet, me, ali):
    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[
                me
            ])

    await invoke(me, vat.init(GEMS))
    await invoke(me, vat.file_ilk(GEMS, SPOT, ray(0.5)))
    await invoke(me, vat.file_ilk(GEMS, line, rad(1000)))
    await invoke(me, vat.file(Line, rad(1000)))

    await invoke(me, vat.slip(GEMS, ali.contract_address, wad(8)))

    defs = SimpleNamespace(
        vat=compile(TEST_VAT_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        serialized_contracts=dict(
            vat=serialize_contract(vat, defs.vat.abi),
        ),
    )

@pytest.fixture(scope="module")
async def copyable_deployment_fork(
    request,
    ctx_factory
):
    CACHE_KEY = "deployment_fork"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.me, ctx.ali)
    res = dill.dumps(val).decode("cp437")
    request.config.cache.set(CACHE_KEY, res)
    return val

@pytest.fixture(scope="module")
async def ctx_factory_fork(copyable_deployment_fork):
    def make():
        serialized_contracts = copyable_deployment_fork.serialized_contracts

        starknet_state = copyable_deployment_fork.starknet.state.copy()
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
def ctx_fork(ctx_factory_fork):
    ctx = ctx_factory_fork()
    return ctx

@pytest.fixture(scope="function")
async def vat(ctx_fork) -> StarknetContract:
    return ctx_fork.vat


###########
# HELPERS #
###########
@pytest.fixture(scope="function")
async def can_fork(vat):
    async def inner(user, a, b, c, d, e):
        try:
            await invoke(user.contract_address, vat.fork(a, b, c, d, e))
            return True
        except:
            return False
    return inner


#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_fork_to_self(ali, vat, can_fork):
    a = ali.contract_address

    await invoke(a, vat.frob(GEMS, a, a, a, wad(8), wad(4)))
    assert (await can_fork(ali, GEMS, a, a, wad(8), wad(4)))
    assert (await can_fork(ali, GEMS, a, a, wad(4), wad(2)))
    assert not (await can_fork(ali, GEMS, a, a, wad(9), wad(4)))


@pytest.mark.asyncio
async def test_give_to_other(ali, bob, vat, can_fork):
    a = ali.contract_address
    b = bob.contract_address

    await invoke(a, vat.frob(GEMS, a, a, a, wad(8), wad(4)))
    assert not (await can_fork(ali, GEMS, a, b, wad(8), wad(4)))
    await invoke(b, vat.hope(a))
    assert (await can_fork(ali, GEMS, a, b, wad(8), wad(4)))


@pytest.mark.asyncio
async def test_fork_to_other(ali, bob, vat, can_fork):
    a = ali.contract_address
    b = bob.contract_address

    await invoke(a, vat.frob(GEMS, a, a, a, wad(8), wad(4)))
    await invoke(b, vat.hope(a))
    assert (await can_fork(ali, GEMS, a, b, wad(4), wad(2)))
    assert not (await can_fork(ali, GEMS, a, b, wad(4), wad(3)))
    assert not (await can_fork(ali, GEMS, a, b, wad(4), wad(1)))


@pytest.mark.asyncio
async def test_fork_dust(me, ali, bob, vat, can_fork):
    a = ali.contract_address
    b = bob.contract_address

    print(wad(8))
    await invoke(a, vat.frob(GEMS, a, a, a, wad(8), wad(4)))
    await invoke(b, vat.hope(a))
    assert (await can_fork(ali, GEMS, a, b, wad(4), wad(2)))
    await invoke(me, vat.file_ilk(GEMS, DUST, rad(1)))
    assert (await can_fork(ali, GEMS, a, b, wad(2), wad(1)))
    assert not (await can_fork(ali, GEMS, a, b, wad(1), wad(0.5)))
