import pytest
import dill
from types import SimpleNamespace

from starkware.starknet.testing.starknet import Starknet, DeclaredClass
from starkware.starknet.testing.contract import StarknetContract
from conftest import (
    compile,
    serialize_contract,
    unserialize_contract,
    rad,
    VAT_FILE,
    invoke,
    call
)


# Based on https://github.com/makerdao/xdomain-dss/blob/f447e779576942cf983c00ee8b9dafa937d2427f/src/test/Vat.t.sol

#########
# SETUP #
#########
async def __setup__(starknet, me, ali):
    vat = await starknet.deploy(
            source=VAT_FILE,
            constructor_calldata=[
                me
            ])


    defs = SimpleNamespace(
        vat=compile(VAT_FILE),
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


#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_swell(vat, ali, me):
    a = ali.contract_address

    assert (await call(vat.dai(a))) == rad(0)
    assert (await call(vat.surf())) == rad(0)
    await invoke(me, vat.swell(a, rad(100)))
    assert (await call(vat.dai(a))) == rad(100)
    assert (await call(vat.surf())) == rad(100)
    await invoke(me, vat.swell(a, rad(-50)))
    assert (await call(vat.dai(a))) == rad(50)
    assert (await call(vat.surf())) == rad(50)
    await invoke(me, vat.suck(123, a, rad(100)))
    assert (await call(vat.dai(a))) == rad(150)
    assert (await call(vat.surf())) == rad(50)
    await invoke(me, vat.swell(a, rad(-75))) # Swell can be negative
    assert (await call(vat.dai(a))) == rad(75)
    assert (await call(vat.surf())) == rad(-25)
