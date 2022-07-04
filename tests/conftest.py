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

# pytest-xdest only shows stderr
sys.stdout = sys.stderr

SUPER_ADJUDICATOR_L1_ADDRESS = 0
CONTRACT_SRC = [os.path.dirname(__file__), "..", "..", "contracts", "starknet"]

###########
# HELPERS #
###########
def check_event(contract, event_name, tx, values):
    expected_event = Event(
        from_address=contract.contract_address,
        keys=[get_selector_from_name(event_name)],
        data=list(chain(*[e if isinstance(e, tuple) else [e] for e in values]))
    )
    assert expected_event in ( tx.raw_events if hasattr(tx, 'raw_events') else tx.get_sorted_events())


async def check_balance(
    token: StarknetContract,
    contract: StarknetContract,
    expected_balance
):
    balance = await token.balanceOf(contract.contract_address).call()
    assert balance.result == (to_split_uint(expected_balance),)


ray = lambda x: to_split_uint(int(x) * (10**9))
rad = lambda x: to_split_uint(int(x) * (10**27))

ether = 10**18
MAX = 2**256-1

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

def encode(string):
    return int.from_bytes(string.encode("utf-8"), byteorder="big")


async def build_copyable_deployment():
    starknet = await Starknet.empty()

    # initialize a realistic timestamp
    set_block_timestamp(starknet.state, round(time.time()))

    signers = dict(
        user1=Signer(23904852345),
        user2=Signer(23904852345),
        user3=Signer(23904852345),
        auth_user=Signer(83745982347),
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

    consts = SimpleNamespace(
    )

    return SimpleNamespace(
        starknet=starknet,
        consts=consts,
        signers=signers,
        serialized_contracts=dict(
            user1=serialize_contract(accounts.user1, defs.account.abi),
            user2=serialize_contract(accounts.user2, defs.account.abi),
            user3=serialize_contract(accounts.user3, defs.account.abi),
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
        signers = copyable_deployment.signers
        consts = copyable_deployment.consts

        starknet_state = copyable_deployment.starknet.state.copy()
        contracts = {
            name: unserialize_contract(starknet_state, serialized_contract)
            for name, serialized_contract in serialized_contracts.items()
        }

        async def execute(account_name, contract_address, selector_name, calldata):
            return await signers[account_name].send_transaction(
                contracts[account_name],
                contract_address,
                selector_name,
                calldata,
            )

        def advance_clock(num_seconds):
            set_block_timestamp(
                starknet_state, get_block_timestamp(starknet_state) + num_seconds
            )

        return SimpleNamespace(
            starknet=Starknet(starknet_state),
            advance_clock=advance_clock,
            consts=consts,
            execute=execute,
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
async def block_timestamp(starknet):
    return lambda: get_block_timestamp(starknet.state)

@pytest.fixture(scope="function")
async def user1(ctx) -> StarknetContract:
    return ctx.user1

@pytest.fixture(scope="function")
async def user2(ctx) -> StarknetContract:
    return ctx.user2

@pytest.fixture(scope="function")
async def user3(ctx) -> StarknetContract:
    return ctx.user3
