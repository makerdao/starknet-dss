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
            source=VAT_FILE,
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
                gold.contract_address
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
                dai.contract_address
            ])

    await dai.setOwner(daiA.contract_address).invoke().invoke(user1.contract_address)

    defs = SimpleNamespace(
        vat=compile(VAT_FILE),
        gem_join=compile(GEM_JOIN_FILE),
        mock_token=compile(MOCK_TOKEN_FILE),
        dai_join=compile(DAI_JOIN_FILE),
    )

    return SimpleNamespace(
        serialized_contracts=dict(
            vat=serialize_contract(vat, defs.vat.abi),
            gem=serialize_contract(gem, defs.mock_token.abi),
            gemA=serialize_contract(gemA, defs.gem_join.abi),
            dai=serialized_contracts(dai, defs.mock_token.abi),
            daiA=serialized_contracts(dai, defs.dai_join.abi),
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
        serialized_contracts = copyable_deployment.serialized_contracts

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

#########
# TESTS #
#########
