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
    MOCK_TOKEN_FILE
)

from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain

starknet_contract_address = 0x0


###########
# HELPERS #
###########

async def __setup__(starknet, user1):
    vat = await starknet.deploy(
            source=VAT_FILE,
            constructor_calldata=[
                user1.contract_address,
            ])
    gold = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                encode("GEM"),
            ])
    await gold.mint(user1.contract_address, to_split_uint(1000*ether)).invoke(user1.contract_address)

    await vat.init(gold.contract_address).invoke(user1.contract_address)
    gemA = await starknet.deploy(
            source=GEM_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                encode("GOLD"),
                gold.contract_address
            ])

    await vat.file_ilk(encode("gold"), encode("spot"), to_split_uint(ray(1*ether))).invoke(user1.contract_address)
    await vat.file_ilk(encode("gold"), encode("line"), to_split_uint(ray(1000*ether))).invoke(user1.contract_address)
    await vat.file(encode("Line"), to_split_uint(rad(1000*ether))).invoke(user1.contract_address)

    await gold.approve(gemA.contract_address, to_split_uint(MAX)).invoke(user1.contract_address)
    await gold.approve(vat.contract_address, to_split_uint(MAX)).invoke(user1.contract_address)

    await vat.rely(vat.contract_address).invoke(user1.contract_address)
    await vat.rely(gemA.contract_address).invoke(user1.contract_address)

    await gemA.join(user1.contract_address, to_split_uint(1000*ether)).invoke(user1.contract_address)

    defs = SimpleNamespace(
        vat=compile(VAT_FILE),
        gem_join=compile(GEM_JOIN_FILE),
        mock_token=compile(MOCK_TOKEN_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        serialized_contracts=dict(
            vat=serialize_contract(vat, defs.vat.abi),
            gold=serialize_contract(gold, defs.mock_token.abi),
            gemA=serialize_contract(gemA, defs.gem_join.abi),
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
    await check_balance(gold, user1, 0)
    await check_balance(gold, gemA, 1500*ether)

    await gemA.exit(user1.contract_address, to_split_uint(250*ether)).invoke(user1.contract_address)
    await check_balance(gold, user1, 250*ether)
    await check_balance(gold, gemA, 1250*ether)
   

@pytest.mark.asyncio
async def test_lock(
    user1: StarknetContract,
    vat: StarknetContract
):
    ink = await vat.ink(encode("gold"), user1.contract_address).invoke(user1.contract_address)
    assert ink.result == (to_split_uint(0),)
    gem = await vat.gem(encode("gold"), user1.contract_address).call()
    assert gem.result == (to_split_uint(1000*ether),)

    await vat.frob("gold", user1.contract_address, user1.contract_address, user1.contract_address, to_split_uint(6*ether), to_split_uint(0))
    ink = await vat.ink(encode("gold"), user1.contract_address).call()
    assert ink.result == (to_split_uint(6*ether),)
    gem = await vat.gem(encode("gold"), user1.contract_address).call()
    assert gem.result == (to_split_uint(994*ether),)

    '''
    await vat.frob(encode("gold"), user1.contract_address, user1.contract_address, user1.contract_address, to_split_uint(-6*ether), to_split_uint(0))
    ink = await vat.ink(encode("gold"), user1.contract_address).call()
    assert ink.result == (to_split_uint(0),)
    gem = await vat.gem(encode("gold"), user1.contract_address).call()
    assert gem.result == (to_split_uint(1000*ether),)
    '''
