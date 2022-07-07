import pytest
import dill
from types import SimpleNamespace

from starkware.starknet.testing.starknet import Starknet, DeclaredClass
from starkware.starknet.testing.contract import StarknetContract
from conftest import (
    to_split_uint,
    to_uint,
    encode,
    compile,
    serialize_contract,
    unserialize_contract,
    ray,
    rad,
    wad,
    VAT_FILE,
    GOLD,
    LINE,
    SPOT,
    call,
    invoke
)


#########
# SETUP #
#########
async def __setup__(starknet, me):
    vat = await starknet.deploy(
            source=VAT_FILE,
            constructor_calldata=[
                me
            ])
    await invoke(me, vat.init(GOLD))
    await invoke(me, vat.file(encode("Line"), rad(100)))
    await invoke(me, vat.file_ilk(GOLD, LINE, rad(100)))

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
async def copyable_deployment_fold(request, ctx_factory):
    CACHE_KEY = "deployment_fold"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.me)
    res = dill.dumps(val).decode("cp437")
    request.config.cache.set(CACHE_KEY, res)
    return val

@pytest.fixture(scope="module")
async def ctx_factory_fold(copyable_deployment_fold):
    def make():
        serialized_contracts = copyable_deployment_fold.serialized_contracts

        starknet_state = copyable_deployment_fold.starknet.state.copy()
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
def ctx_fold(ctx_factory_fold):
    ctx = ctx_factory_fold()
    return ctx

@pytest.fixture(scope="function")
async def vat(ctx_fold) -> StarknetContract:
    return ctx_fold.vat


###########
# HELPERS #
###########
async def tab(vat, ilk, urn):
    res = await vat.urns(ilk, urn).call()
    ((ink_, art_),) = res.result
    res = await vat.ilks(ilk).call()
    ((Art_, rate, spot, line, dust),) = res.result
    return to_split_uint(to_uint(art_) * to_uint(rate))


async def jam(vat, ilk, urn):
    res = await vat.urns(ilk, urn).call()
    (ink_, art_) = res.result[0]
    return ink_


async def draw(vat, me, ilk, dai):
    await invoke(me, vat.file(encode("Line"), rad(dai)))
    await invoke(me, vat.file_ilk(ilk, LINE, rad(dai)))
    await invoke(me, vat.file_ilk(ilk, SPOT, rad(10000)))
    await invoke(me, vat.slip(ilk, me, rad(1)))
    await invoke(me, vat.frob(
        ilk,
        me,
        me,
        me,
        wad(1),
        wad(dai)
    ))


#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_fold(me, vat):
    await draw(vat, me, GOLD, 1)
    ali = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D

    assert (await tab(vat, GOLD, me)) == rad(1)
    await invoke(me, vat.fold(GOLD, ali, ray(0.05)))
    assert (await tab(vat, GOLD, me)) == rad(1.05)
    assert (await call(vat.dai(ali))) == rad(0.05)
