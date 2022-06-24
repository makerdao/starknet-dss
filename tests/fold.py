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
)

from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain


###########
# HELPERS #
###########

async def __setup__(
    starknet: StarknetContract,
    user1: StarknetContract
):
    vat = await starknet.deploy(
            source=VAT_FILE,
            constructor_calldata=[
                user1.contract_address,
            ])
    await vat.init(encode("gold")).invoke(user1.contract_address)
    await vat.file(encode("Line"), rad(100*ether)).invoke(user1.contract_address)
    await vat.file_ilk(encode("gold"), encode("line"), rad(100*ether)).invoke(user1.contract_address)

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
    val = await __setup__(ctx.starknet, ctx.user1)
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


async def draw(vat, user1, ilk, dai):
    await vat.file(encode("Line"), rad(dai)).invoke(user1.contract_address)
    await vat.file_ilk(ilk, encode("line"), rad(dai)).invoke(user1.contract_address)
    await vat.file_ilk(ilk, encode("spot"), to_split_uint((10**27)*10000*ether)).invoke(user1.contract_address)
    await vat.slip(ilk, user1.contract_address, to_split_uint((10**27)*1*ether)).invoke(user1.contract_address)
    await vat.frob(
        ilk,
        user1.contract_address,
        user1.contract_address,
        user1.contract_address,
        to_split_uint(1*ether),
        to_split_uint(dai)
    ).invoke(user1.contract_address)


@pytest.mark.asyncio
async def test_fold(
    user1: StarknetContract,
    vat: StarknetContract
):
    await draw(vat, user1, encode("gold"), 1*ether)
    ali = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D

    res = await tab(vat, encode("gold"), user1.contract_address)
    assert res == rad(1*ether)
    await vat.fold(encode("gold"), ali, ray(0.05*ether)).invoke(user1.contract_address)
    res = await tab(vat, encode("gold"), user1.contract_address)
    assert res == rad(1.05*ether)
    res = await vat.dai(ali).call()
    assert res.result == (rad(0.05*ether),)
