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
    VAT_FILE,
    GOLD,
    LINE,
    SPOT,
    call
)

from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain


###########
# HELPERS #
###########

async def __setup__(
    starknet: StarknetContract,
    auth: StarknetContract
):
    vat = await starknet.deploy(
            source=VAT_FILE,
            constructor_calldata=[
                auth.contract_address,
            ])
    await vat.init(GOLD).invoke(auth.contract_address)
    await vat.file(encode("Line"), rad(100)).invoke(auth.contract_address)
    await vat.file_ilk(GOLD, LINE, rad(100)).invoke(auth.contract_address)

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
async def copyable_deployment_fold(
    request,
    ctx_factory
):
    CACHE_KEY = "deployment_fold"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.auth)
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

@pytest.fixture(scope="function")
def ctx_fold(ctx_factory_fold):
    ctx = ctx_factory_fold()
    return ctx

@pytest.fixture(scope="function")
async def vat(ctx_fold) -> StarknetContract:
    return ctx_fold.vat


#########
# TESTS #
#########
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


async def draw(vat, auth, ilk, dai):
    await vat.file(encode("Line"), rad(dai)).invoke(auth.contract_address)
    await vat.file_ilk(ilk, LINE, rad(dai)).invoke(auth.contract_address)
    await vat.file_ilk(ilk, SPOT, rad(10000)).invoke(auth.contract_address)
    await vat.slip(ilk, auth.contract_address, rad(1)).invoke(auth.contract_address)
    await vat.frob(
        ilk,
        auth.contract_address,
        auth.contract_address,
        auth.contract_address,
        ether(1),
        ether(dai)
    ).invoke(auth.contract_address)


@pytest.mark.asyncio
async def test_fold(
    auth: StarknetContract,
    vat: StarknetContract
):
    await draw(vat, auth, GOLD, 1)
    ali = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D

    assert (await tab(vat, GOLD, auth.contract_address)) == rad(1)
    await vat.fold(GOLD, ali, ray(0.05)).invoke(auth.contract_address)
    assert (await tab(vat, GOLD, auth.contract_address)) == rad(1.05)
    assert (await call(vat.dai(ali))) == rad(0.05)
