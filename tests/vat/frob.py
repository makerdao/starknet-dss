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
    balance_of,
    ray,
    rad,
    wad,
    MAX,
    TEST_VAT_FILE,
    GEM_JOIN_FILE,
    MOCK_TOKEN_FILE,
    GOLD,
    LINE,
    SPOT,
    GEM,
    DUST,
    call,
    invoke
)


#########
# SETUP #
#########
async def __setup__(starknet, me):
    vat = await starknet.deploy(
            source=TEST_VAT_FILE,
            constructor_calldata=[
                me,
            ])
    gold = await starknet.deploy(
            source=MOCK_TOKEN_FILE,
            constructor_calldata=[
                GEM,
            ])
    await invoke(me, gold.mint(me, wad(1000)))

    await invoke(me, vat.init(GOLD))
    gemA = await starknet.deploy(
            source=GEM_JOIN_FILE,
            constructor_calldata=[
                vat.contract_address,
                GOLD,
                gold.contract_address,
                me
            ])

    await invoke(me, vat.file_ilk(GOLD, SPOT, ray(1)))
    await invoke(me, vat.file_ilk(GOLD, LINE, rad(1000)))
    await invoke(me, vat.file(encode("Line"), rad(1000)))
    '''
    jug = await starknet.deploy(
            source=JUG_FILE,
            constructor_calldata=[
                vat.contract_address,
            ])
    await invoke(me, jug.init(GOLD))
    await invoke(me, vat.rely(jug.contract_address))
    '''

    await invoke(me, gold.approve(gemA.contract_address, MAX))
    await invoke(me, gold.approve(vat.contract_address, MAX))

    await invoke(me, vat.rely(vat.contract_address))
    await invoke(me, vat.rely(gemA.contract_address))

    await invoke(me, gemA.join(me, wad(1000)))

    defs = SimpleNamespace(
        vat=compile(TEST_VAT_FILE),
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
async def copyable_deployment_frob(request, ctx_factory):
    CACHE_KEY = "deployment_frob"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.me)
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


#########
# STATE #
#########
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


###########
# HELPERS #
###########
@pytest.fixture(scope="function")
async def can_frob(vat):
    async def inner(user, a, b, c, d, e):
        try:
            await invoke(user.contract_address, vat.frob(GOLD, a, b, c, d, e))
            return True
        except:
            return False
    return inner

@pytest.fixture(scope="function")
async def try_frob(vat, me):
    async def inner(ilk, ink, art):
        try:
            await invoke(me, vat.frob(ilk, me, me, me, ink, art))
            return True
        except:
            return False
    return inner


#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_setup(me, vat, gemA, gold):
    assert (await balance_of(gold, gemA)) == wad(1000)
    assert (await call(vat.gem(GOLD, me))) == wad(1000)


@pytest.mark.asyncio
async def test_join(me, gemA, gold):
    await invoke(me, gold.mint(me, wad(500)))
    assert (await balance_of(gold, me)) == wad(500)
    assert (await balance_of(gold, gemA)) == wad(1000)

    await invoke(me, gemA.join(me, wad(500)))
    assert (await balance_of(gold, me)) == wad(0)
    assert (await balance_of(gold, gemA)) == wad(1500)

    await invoke(me, gemA.exit(me, wad(250)))
    assert (await balance_of(gold, me)) == wad(250)
    assert (await balance_of(gold, gemA)) == wad(1250)


@pytest.mark.asyncio
async def test_lock(me, vat):
    assert (await call(vat.ink(GOLD, me))) == wad(0)
    assert (await call(vat.gem(GOLD, me))) == wad(1000)

    await invoke(me, vat.frob(GOLD, me, me, me, wad(6), wad(0)))
    assert (await call(vat.ink(GOLD, me))) == wad(6)
    assert (await call(vat.gem(GOLD, me))) == wad(994)

    await invoke(me, vat.frob(GOLD, me, me, me, wad(-6), wad(0)))
    assert (await call(vat.ink(GOLD, me))) == wad(0)
    assert (await call(vat.gem(GOLD, me))) == wad(1000)


@pytest.mark.asyncio
async def test_calm(me, vat, try_frob):
    await invoke(me, vat.file_ilk(GOLD, LINE, rad(10)))
    assert (await try_frob(GOLD, wad(10), wad(9)))
    assert not (await try_frob(GOLD, wad(0), wad(2)))


@pytest.mark.asyncio
async def test_cool(me, vat, try_frob):
    await invoke(me, vat.file_ilk(GOLD, LINE, rad(10)))
    assert (await try_frob(GOLD, wad(10), wad(8)))
    await invoke(me, vat.file_ilk(GOLD, LINE, rad(5)))
    assert (await try_frob(GOLD, wad(0), wad(-1)))


@pytest.mark.asyncio
async def test_safe(me, vat, try_frob):
    await invoke(me, vat.frob(GOLD, me, me, me, wad(10), wad(5)))
    assert not (await try_frob(GOLD, wad(0), wad(6)))


@pytest.mark.asyncio
async def test_nice(me, vat, try_frob):
    await invoke(me, vat.frob(GOLD, me, me, me, wad(10), wad(10)))
    await invoke(me, vat.file_ilk(GOLD, SPOT, ray(0.5)))
    ilk = await call(vat.ilks(GOLD))

    assert not (await try_frob(GOLD, wad(0), wad(1)))
    assert (await try_frob(GOLD, wad(0), wad(-1)))
    assert not (await try_frob(GOLD, wad(-1), wad(0)))
    assert (await try_frob(GOLD, wad(1),  wad(0)))

    assert not (await try_frob(GOLD, wad(-2), wad(-4)))
    assert not (await try_frob(GOLD,  wad(5),  wad(1)))

    assert (await try_frob(GOLD, wad(-1), wad(-4)))
    await invoke(me, vat.frob(GOLD, me, me, me, wad(-1), wad(-4)))
    await invoke(me, vat.file_ilk(GOLD, SPOT, ray(0.4)))
    assert (await try_frob(GOLD,  wad(5),  wad(1)))


@pytest.mark.asyncio
async def test_alt_callers(me, vat, ali, bob, che, can_frob):
    a = ali.contract_address
    b = bob.contract_address
    c = che.contract_address

    await invoke(me, vat.slip(GOLD, a, rad(20)))
    await invoke(me, vat.slip(GOLD, b, rad(20)))
    await invoke(me, vat.slip(GOLD, c, rad(20)))

    await invoke(a, vat.frob(GOLD, a, a, a, wad(10), wad(5)))

    # anyone can lock
    assert (await can_frob(ali, a, a, a, wad(1), wad(0)))
    assert (await can_frob(bob, a, b, b, wad(1), wad(0)))
    assert (await can_frob(che, a, c, c, wad(1), wad(0)))
    # but only with their own gems
    assert not (await can_frob(ali, a, b, a, wad(1), wad(0)))
    assert not (await can_frob(bob, a, c, b, wad(1), wad(0)))
    assert not (await can_frob(che, a, a, c, wad(1), wad(0)))

    # only the lad can free
    assert (await can_frob(ali, a, a, a,  wad(-1), wad(0)))
    assert not (await can_frob(bob, a, b, b, wad(-1), wad(0)))
    assert not (await can_frob(che, a, c, c, wad(-1), wad(0)))
    # the lad can free the anywhere
    assert (await can_frob(ali, a, b, a, wad(-1), wad(0)))
    assert (await can_frob(ali, a, c, a, wad(-1), wad(0)))

    # only the lad can draw
    assert (await can_frob(ali, a, a, a, wad(0), wad(1)))
    assert not (await can_frob(bob, a, b, b, wad(0), wad(1)))
    assert not (await can_frob(che, a, c, c, wad(0), wad(1)))
    # the lad can draw to anywhere
    assert (await can_frob(ali, a, a, b, wad(0), wad(1)))
    assert (await can_frob(ali, a, a, c, wad(0), wad(1)))

    await invoke(me, vat.mint(b, wad(1)))
    await invoke(me, vat.mint(c, wad(1)))

    # anyone can wipe
    assert (await can_frob(ali, a, a, a, wad(0), wad(-1)))
    assert (await can_frob(bob, a, b, b, wad(0), wad(-1)))
    assert (await can_frob(che, a, c, c, wad(0), wad(-1)))
    # but only with their own dai
    assert not (await can_frob(ali, a, a, b, wad(0), wad(-1)))
    assert not (await can_frob(bob, a, b, c, wad(0), wad(-1)))
    assert not (await can_frob(che, a, c, a, wad(0), wad(-1)))


@pytest.mark.asyncio
async def test_hope(me, vat, ali, bob, che, can_frob):
    a = ali.contract_address
    b = bob.contract_address
    c = che.contract_address

    await invoke(me, vat.slip(GOLD, a, rad(20)))
    await invoke(me, vat.slip(GOLD, b, rad(20)))
    await invoke(me, vat.slip(GOLD, c, rad(20)))

    await invoke(a, vat.frob(GOLD, a, a, a, wad(10), wad(5)))

    assert (await can_frob(ali, a, a, a, wad(0), wad(1)))
    assert not (await can_frob(bob, a, b, b, wad(0), wad(1)))
    assert not (await can_frob(che, a, c, c, wad(0), wad(1)))

    await invoke(a, vat.hope(b))

    assert (await can_frob(ali, a, a, a, wad(0), wad(1)))
    assert (await can_frob(bob, a, b, b, wad(0), wad(1)))
    assert not (await can_frob(che, a, c, c, wad(0), wad(1)))


@pytest.mark.asyncio
async def test_dust(me, vat, try_frob):
    assert (await try_frob(GOLD, wad(9),  wad(1)))
    await invoke(me, vat.file_ilk(GOLD, DUST, rad(5)))
    assert not (await try_frob(GOLD, wad(5),  wad(2)))
    assert (await try_frob(GOLD, wad(0),  wad(5)))
    assert not (await try_frob(GOLD, wad(0), wad(-5)))
    assert (await try_frob(GOLD, wad(0), wad(-6)))
