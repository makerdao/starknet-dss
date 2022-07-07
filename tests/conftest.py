import asyncio
import pytest
import dill
import os
import sys
from types import SimpleNamespace
import time

from starkware.starknet.compiler.compile import compile_starknet_files
from starkware.starknet.testing.starknet import Starknet, StarknetContract, DeclaredClass
from starkware.starknet.business_logic.state.state import BlockInfo
from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain

from Signer import Signer

sys.stdout = sys.stderr

SUPER_ADJUDICATOR_L1_ADDRESS = 0
CONTRACT_SRC = [os.path.dirname(__file__), "..", "..", "contracts", "starknet"]
MAX = (2**128-1, 2**128-1)

def encode(string):
    return int.from_bytes(string.encode("utf-8"), byteorder="big")
GOLD = encode("gold")
GEM = encode("gem")
GEMS = encode("gems")
SPOT = encode("spot")
LINE = encode("line")
DUST = encode("dust")


###########
# HELPERS #
###########
async def balance_of(token, contract):
    if (hasattr(contract, 'contract_address')):
        address = contract.contract_address
    else:
        address = contract
    res = await call(token.balanceOf(address))
    return res

async def call(_):
    res = await _.call()
    return res.result[0]

async def invoke(user, _):
    await _.invoke(user)

def to_split_uint(a):
    return (a & ((1 << 128) - 1), a >> 128)

def to_split_uint_neg(a):
    _ = to_split_uint(a*-1)
    return (
        0xffffffffffffffffffffffffffffffff - _[0] + 1,
        0xffffffffffffffffffffffffffffffff - _[1],
    )

def to_uint(a):
    return a[0] + (a[1] << 128)
def ray(x):
    if (x>=0):
        return to_split_uint(int(x*(10**18)) * 10**9)
    else:
        return to_split_uint_neg(int(x*(10**18)) * 10**9)
def rad(x):
    if (x>=0):
        return to_split_uint(int(x*(10**18)) * 10**27)
    else:
        return to_split_uint_neg(int(x*(10**18)) * 10**27)
def wad(x):
    if (x>=0):
        return to_split_uint(int(x*(10**18)))
    else:
        return to_split_uint_neg(int(x*(10**18)))



async def deploy_account(starknet, signer, source):
    return await starknet.deploy(
        source=source,
        constructor_calldata=[signer.public_key],
    )

def compile(path):
    return compile_starknet_files(
        files=[path],
        debug_info=True,
        cairo_path=CONTRACT_SRC,
    )


def get_block_timestamp(starknet_state):
    return starknet_state.state.block_info.block_timestamp


def set_block_timestamp(starknet_state, timestamp):
    starknet_state.state.block_info = BlockInfo.create_for_testing(
        starknet_state.state.block_info.block_number, timestamp
    )


# StarknetContracts contain an immutable reference to StarknetState, which
# means if we want to be able to use StarknetState's `copy` method, we cannot
# rely on StarknetContracts that were created prior to the copy.
# For this reason, we specifically inject a new StarknetState when
# deserializing a contract.
def serialize_contract(contract, abi):
    return dict(
        abi=abi,
        contract_address=contract.contract_address,
        deploy_execution_info=contract.deploy_execution_info,
    )


def unserialize_contract(starknet_state, serialized_contract):
    return StarknetContract(state=starknet_state, **serialized_contract)


@pytest.fixture(scope="session")
def event_loop():
    return asyncio.new_event_loop()

CONTRACTS_DIR = os.path.join(os.getcwd(), "contracts")
TESTS_DIR = os.path.join(os.getcwd(), "contracts/tests")
ACCOUNT_FILE = os.path.join(CONTRACTS_DIR, "account.cairo")
VAT_FILE = os.path.join(CONTRACTS_DIR, "vat.cairo")
GEM_JOIN_FILE = os.path.join(CONTRACTS_DIR, "gem_join.cairo")
MOCK_TOKEN_FILE = os.path.join(TESTS_DIR, "mock_token.cairo")
DAI_JOIN_FILE = os.path.join(CONTRACTS_DIR, "dai_join.cairo")
HEVM_FILE = os.path.join(CONTRACTS_DIR, "hevm.cairo")
TEST_VAT_FILE = os.path.join(TESTS_DIR, "test_vat.cairo")
TEST_VOW_FILE = os.path.join(TESTS_DIR, "test_vow.cairo")
FLAPPER_FILE = os.path.join(CONTRACTS_DIR, "flapper.cairo")
FLOPPER_FILE = os.path.join(CONTRACTS_DIR, "flopper.cairo")
FLIPPER_FILE = os.path.join(CONTRACTS_DIR, "flipper.cairo")
JUG_FILE = os.path.join(CONTRACTS_DIR, "jug.cairo")
CAT_FILE = os.path.join(CONTRACTS_DIR, "cat.cairo")
USR_FILE = os.path.join(TESTS_DIR, "usr.cairo")


async def build_copyable_deployment():
    starknet = await Starknet.empty()

    # initialize a realistic timestamp
    set_block_timestamp(starknet.state, round(time.time()))

    signers = dict(
        ali=Signer(23904852345),
        bob=Signer(23904852345),
        che=Signer(23904852345),
        auth=Signer(83745982347),
    )

    # Maps from name -> account contract
    accounts = SimpleNamespace(
        **{
            name: (await deploy_account(starknet, signer, ACCOUNT_FILE))
            for name, signer in signers.items()
        }
    )

    defs = SimpleNamespace(
        account=compile(ACCOUNT_FILE),
        vat=compile(VAT_FILE),
        gem_join=compile(GEM_JOIN_FILE),
        mock_token=compile(MOCK_TOKEN_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        me=accounts.auth.contract_address,
        serialized_contracts=dict(
            auth=serialize_contract(accounts.auth, defs.account.abi),
            ali=serialize_contract(accounts.ali, defs.account.abi),
            bob=serialize_contract(accounts.bob, defs.account.abi),
            che=serialize_contract(accounts.che, defs.account.abi),
        ),
    )


@pytest.fixture(scope="session")
async def copyable_deployment(request):
    CACHE_KEY = "deployment"
    val = request.config.cache.get(CACHE_KEY, None)
    val = await build_copyable_deployment()
    res = dill.dumps(val).decode("cp437")
    request.config.cache.set(CACHE_KEY, res)
    return val


@pytest.fixture(scope="session")
async def ctx_factory(copyable_deployment):
    def make():
        serialized_contracts = copyable_deployment.serialized_contracts

        starknet_state = copyable_deployment.starknet.state.copy()
        contracts = {
            name: unserialize_contract(starknet_state, serialized_contract)
            for name, serialized_contract in serialized_contracts.items()
        }

        return SimpleNamespace(
            starknet=Starknet(starknet_state),
            me=copyable_deployment.me,
            **contracts,
        )

    return make

@pytest.fixture(scope="function")
def ctx(ctx_factory):
    ctx = ctx_factory()
    return ctx

@pytest.fixture(scope="function")
async def starknet(ctx) -> Starknet:
    return ctx.starknet

@pytest.fixture(scope="function")
async def me(ctx) -> int:
    return ctx.me

@pytest.fixture(scope="function")
async def auth(ctx) -> StarknetContract:
    return ctx.auth

@pytest.fixture(scope="function")
async def ali(ctx) -> StarknetContract:
    return ctx.ali

@pytest.fixture(scope="function")
async def bob(ctx) -> StarknetContract:
    return ctx.bob

@pytest.fixture(scope="function")
async def che(ctx) -> StarknetContract:
    return ctx.che
