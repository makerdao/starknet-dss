import pytest
import dill
from types import SimpleNamespace

from starkware.starknet.testing.starknet import Starknet, DeclaredClass
from starkware.starknet.testing.contract import StarknetContract
from starkware.starkware_utils.error_handling import StarkException
from starkware.starknet.definitions.error_codes import StarknetErrorCode
from conftest import (
    to_split_uint,
    to_split_uint_neg,
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
    TEST_VAT_FILE,
    GEM_JOIN_FILE,
    MOCK_TOKEN_FILE,
    USR_FILE,
    GOLD,
    LINE,
    SPOT,
    GEM,
    DUST,
    call
)

from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain

starknet_contract_address = 0x0

###########
# HELPERS #
###########

async def __setup__(
    starknet: Starknet,
    auth: StarknetContract
):
    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[
                auth.contract_address,
            ])
    gold = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                GEM,
            ])
    await gold.mint(auth.contract_address, ether(1000)).invoke(auth.contract_address)

    await vat.init(GOLD).invoke(auth.contract_address)
    gemA = await starknet.deploy(
            source=GEM_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                GOLD,
                gold.contract_address,
                auth.contract_address
            ])

    await vat.file_ilk(GOLD, SPOT, ray(1)).invoke(auth.contract_address)
    await vat.file_ilk(GOLD, LINE, rad(1000)).invoke(auth.contract_address)
    await vat.file(encode("Line"), rad(1000)).invoke(auth.contract_address)
    '''
    jug = await starknet.deploy(
            source=JUG_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    await jug.init(GOLD).invoke(auth.contract_address)
    await vat.rely(jug.contract_address).invoke(auth.contract_address)
    '''

    await gold.approve(gemA.contract_address, MAX).invoke(auth.contract_address)
    await gold.approve(vat.contract_address, MAX).invoke(auth.contract_address)

    await vat.rely(vat.contract_address).invoke(auth.contract_address)
    await vat.rely(gemA.contract_address).invoke(auth.contract_address)

    await gemA.join(auth.contract_address, ether(1000)).invoke(auth.contract_address)

    ali = await starknet.deploy(
            source=USR_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    bob = await starknet.deploy(
            source=USR_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    che = await starknet.deploy(
            source=USR_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])

    defs = SimpleNamespace(
        vat=compile(TEST_VAT_FILE),
        gem_join=compile(GEM_JOIN_FILE),
        mock_token=compile(MOCK_TOKEN_FILE),
        usr=compile(USR_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        serialized_contracts=dict(
            vat=serialize_contract(vat, defs.vat.abi),
            gold=serialize_contract(gold, defs.mock_token.abi),
            gemA=serialize_contract(gemA, defs.gem_join.abi),
            ali=serialize_contract(ali, defs.usr.abi),
            bob=serialize_contract(bob, defs.usr.abi),
            che=serialize_contract(che, defs.usr.abi),
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
    val = await __setup__(ctx.starknet, ctx.auth)
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

@pytest.fixture(scope="function")
async def can_frob(
    vat: StarknetContract,
):
    async def inner(user, a, b, c, d, e):
        try:
            await vat.frob(GOLD, a, b, c, d, e).invoke(user.contract_address)
            return True
        except:
            return False
    return inner

@pytest.fixture(scope="function")
async def try_frob(
    vat: StarknetContract,
    auth: StarknetContract,
):
    me = auth.contract_address
    async def inner(ilk, ink, art):
        try:
            await vat.frob(ilk, me, me, me, ink, art).invoke(me)
            return True
        except:
            return False
    return inner

#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_setup(
    auth: StarknetContract,
    vat: StarknetContract,
    gemA: StarknetContract,
    gold: StarknetContract
):
    await check_balance(gold, gemA, ether(1000))

    assert (await call(vat.gem(GOLD, auth.contract_address))) == ether(1000)


@pytest.mark.asyncio
async def test_join(
    auth: StarknetContract,
    gemA: StarknetContract,
    gold: StarknetContract
):
    await gold.mint(auth.contract_address, ether(500)).invoke(auth.contract_address)
    await check_balance(gold, auth, ether(500))
    await check_balance(gold, gemA, ether(1000))

    await gemA.join(auth.contract_address, ether(500)).invoke(auth.contract_address)
    await check_balance(gold, auth, ether(0))
    await check_balance(gold, gemA, ether(1500))

    await gemA.exit(auth.contract_address, ether(250)).invoke(auth.contract_address)
    await check_balance(gold, auth, ether(250))
    await check_balance(gold, gemA, ether(1250))


@pytest.mark.asyncio
async def test_lock(
    auth: StarknetContract,
    vat: StarknetContract
):
    me = auth.contract_address

    assert (await call(vat.ink(GOLD, me))) == ether(0)
    assert (await call(vat.gem(GOLD, me))) == ether(1000)

    await vat.frob(GOLD, me, me, me, ether(6), ether(0)).invoke(me)
    assert (await call(vat.ink(GOLD, me))) == ether(6)
    assert (await call(vat.gem(GOLD, me))) == ether(994)

    await vat.frob(GOLD, me, me, me, ether(-6), ether(0)).invoke(me)
    assert (await call(vat.ink(GOLD, me))) == ether(0)
    assert (await call(vat.gem(GOLD, me))) == ether(1000)


@pytest.mark.asyncio
async def test_calm(
    auth: StarknetContract,
    vat: StarknetContract,
    try_frob
):
    await vat.file_ilk(GOLD, LINE, rad(10)).invoke(auth.contract_address)
    assert (await try_frob(GOLD, ether(10), ether(9)))
    assert not (await try_frob(GOLD, ether(0), ether(2)))


@pytest.mark.asyncio
async def test_cool(
    auth: StarknetContract,
    vat: StarknetContract,
    try_frob
):
    await vat.file_ilk(GOLD, LINE, rad(10)).invoke(auth.contract_address)
    assert (await try_frob(GOLD, ether(10), ether(8)))
    await vat.file_ilk(GOLD, LINE, rad(5)).invoke(auth.contract_address)
    assert (await try_frob(GOLD, ether(0), ether(-1)))


@pytest.mark.asyncio
async def test_safe(
    auth: StarknetContract,
    vat: StarknetContract,
    try_frob
):
    me = auth.contract_address
    await vat.frob(GOLD, me, me, me, ether(10), ether(5)).invoke(auth.contract_address)
    assert not (await try_frob(GOLD, ether(0), ether(6)))


@pytest.mark.asyncio
async def test_nice(
    auth: StarknetContract,
    vat: StarknetContract,
    try_frob
):
    me = auth.contract_address
    await vat.frob(GOLD, me, me, me, ether(10), ether(10)).invoke(me)
    await vat.file_ilk(GOLD, SPOT, ray(0.5)).invoke(me)
    ilk = await call(vat.ilks(GOLD))

    assert not (await try_frob(GOLD, ether(0), ether(1)))
    assert (await try_frob(GOLD, ether(0), ether(-1)))
    assert not (await try_frob(GOLD, ether(-1), ether(0)))
    assert (await try_frob(GOLD, ether(1),  ether(0)))

    assert not (await try_frob(GOLD, ether(-2), ether(-4)))
    assert not (await try_frob(GOLD,  ether(5),  ether(1)))

    assert (await try_frob(GOLD, ether(-1), ether(-4)))
    await vat.frob(GOLD, me, me, me, ether(-1), ether(-4)).invoke(me)
    await vat.file_ilk(GOLD, SPOT, ray(0.4)).invoke(me)
    assert (await try_frob(GOLD,  ether(5),  ether(1)))


@pytest.mark.asyncio
async def test_alt_callers(
    starknet: Starknet,
    auth: StarknetContract,
    vat: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    can_frob
):
    me = auth.contract_address

    a = ali.contract_address
    b = bob.contract_address
    c = che.contract_address

    await vat.slip(GOLD, a, rad(20)).invoke(me)
    await vat.slip(GOLD, b, rad(20)).invoke(me)
    await vat.slip(GOLD, c, rad(20)).invoke(me)

    await vat.frob(GOLD, a, a, a, ether(10), ether(5)).invoke(a)

    # anyone can lock
    assert (await can_frob(ali, a, a, a, ether(1), ether(0)))
    assert (await can_frob(bob, a, b, b, ether(1), ether(0)))
    assert (await can_frob(che, a, c, c, ether(1), ether(0)))
    # but only with their own gems
    assert not (await can_frob(ali, a, b, a, ether(1), ether(0)))
    assert not (await can_frob(bob, a, c, b, ether(1), ether(0)))
    assert not (await can_frob(che, a, a, c, ether(1), ether(0)))

    # only the lad can free
    assert (await can_frob(ali, a, a, a,  ether(-1), ether(0)))
    assert not (await can_frob(bob, a, b, b, ether(-1), ether(0)))
    assert not (await can_frob(che, a, c, c, ether(-1), ether(0)))
    # the lad can free the anywhere
    assert (await can_frob(ali, a, b, a, ether(-1), ether(0)))
    assert (await can_frob(ali, a, c, a, ether(-1), ether(0)))

    # only the lad can draw
    assert (await can_frob(ali, a, a, a, ether(0), ether(1)))
    assert not (await can_frob(bob, a, b, b, ether(0), ether(1)))
    assert not (await can_frob(che, a, c, c, ether(0), ether(1)))
    # the lad can draw to anywhere
    assert (await can_frob(ali, a, a, b, ether(0), ether(1)))
    assert (await can_frob(ali, a, a, c, ether(0), ether(1)))

    await vat.mint(b, ether(1)).invoke(me)
    await vat.mint(c, ether(1)).invoke(me)

    # anyone can wipe
    assert (await can_frob(ali, a, a, a, ether(0), ether(-1)))
    assert (await can_frob(bob, a, b, b, ether(0), ether(-1)))
    assert (await can_frob(che, a, c, c, ether(0), ether(-1)))
    # but only with their own dai
    assert not (await can_frob(ali, a, a, b, ether(0), ether(-1)))
    assert not (await can_frob(bob, a, b, c, ether(0), ether(-1)))
    assert not (await can_frob(che, a, c, a, ether(0), ether(-1)))


@pytest.mark.asyncio
async def test_hope(
    starknet: Starknet,
    auth: StarknetContract,
    vat: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    can_frob
):
    me = auth.contract_address

    a = ali.contract_address
    b = bob.contract_address
    c = che.contract_address

    await vat.slip(GOLD, a, rad(20)).invoke(me)
    await vat.slip(GOLD, b, rad(20)).invoke(me)
    await vat.slip(GOLD, c, rad(20)).invoke(me)

    await vat.frob(GOLD, a, a, a, ether(10), ether(5)).invoke(a)

    assert (await can_frob(ali, a, a, a, ether(0), ether(1)))
    assert not (await can_frob(bob, a, b, b, ether(0), ether(1)))
    assert not (await can_frob(che, a, c, c, ether(0), ether(1)))

    await vat.hope(b).invoke(a)

    assert (await can_frob(ali, a, a, a, ether(0), ether(1)))
    assert (await can_frob(bob, a, b, b, ether(0), ether(1)))
    assert not (await can_frob(che, a, c, c, ether(0), ether(1)))


@pytest.mark.asyncio
async def test_dust(
    auth: StarknetContract,
    vat: StarknetContract,
    try_frob
):
    me = auth.contract_address
    assert (await try_frob(GOLD, ether(9),  ether(1)))
    await vat.file_ilk(GOLD, DUST, rad(5)).invoke(me)
    assert not (await try_frob(GOLD, ether(5),  ether(2)))
    assert (await try_frob(GOLD, ether(0),  ether(5)))
    assert not (await try_frob(GOLD, ether(0), ether(-5)))
    assert (await try_frob(GOLD, ether(0), ether(-6)))
