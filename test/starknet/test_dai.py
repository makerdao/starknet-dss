import pytest
import dill
from types import SimpleNamespace

from starkware.starknet.testing.contract import StarknetContract
from starkware.starkware_utils.error_handling import StarkException
from starkware.starknet.business_logic.execution.objects import Event
from starkware.starknet.public.abi import get_selector_from_name
from itertools import chain
from conftest import to_split_uint, to_uint, check_event, DAI_FILE, invoke, call, compile, serialize_contract, unserialize_contract

MAX = (2**128-1, 2**128-1)
L1_ADDRESS = 0x1
ECDSA_PUBLIC_KEY = 0

burn = 0
no_funds = 1

starknet_contract_address = 0x0
#########
# SETUP #
#########


async def __setup__(starknet, me, ali, bob):
    dai = await starknet.deploy(
        source=DAI_FILE,
        constructor_calldata=[
            me
        ])

    # intialize two users with 100 DAI
    await invoke(me, dai.mint(ali.contract_address, to_split_uint(100)))
    await invoke(me, dai.mint(bob.contract_address, to_split_uint(100)))

    defs = SimpleNamespace(
        dai=compile(DAI_FILE),
    )

    return SimpleNamespace(
        starknet=starknet,
        serialized_contracts=dict(
            dai=serialize_contract(dai, defs.dai.abi),
        ),
    )


@pytest.fixture(scope="module")
async def copyable_deployment_dai(request, ctx_factory):
    CACHE_KEY = "deployment_dai"
    val = request.config.cache.get(CACHE_KEY, None)
    ctx = ctx_factory()
    val = await __setup__(ctx.starknet, ctx.me, ctx.ali, ctx.bob)
    res = dill.dumps(val).decode("cp437")
    request.config.cache.set(CACHE_KEY, res)
    return val


@pytest.fixture(scope="module")
async def ctx_factory_dai(copyable_deployment_dai):
    def make():
        serialized_contracts = copyable_deployment_dai.serialized_contracts

        starknet_state = copyable_deployment_dai.starknet.state.copy()
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
def ctx_dai(ctx_factory_dai):
    ctx = ctx_factory_dai()
    return ctx


@pytest.fixture(scope="function")
async def dai(ctx_dai) -> StarknetContract:
    return ctx_dai.dai


#########
# TESTS #
#########
@pytest.mark.asyncio
async def test_total_supply(
    dai: StarknetContract,
    ali: StarknetContract,
):
    total_supply = await call(dai.totalSupply())

    assert total_supply == to_split_uint(200)


@pytest.mark.asyncio
async def test_balance_of(
    dai: StarknetContract,
    ali: StarknetContract,
):
    balance = await call(dai.balanceOf(ali.contract_address))

    assert balance == to_split_uint(100)


@pytest.mark.asyncio
async def test_transfer(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    check_balances
):
    tx = await dai.transfer(
        bob.contract_address,
        to_split_uint(10)).invoke(ali.contract_address)
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            bob.contract_address,
            to_split_uint(10)
        )
    )

    await check_balances(90, 110)


@pytest.mark.asyncio
async def test_transfer_to_yourself(
    dai: StarknetContract,
    ali: StarknetContract,
    check_balances,
):
    tx = await invoke(ali.contract_address, dai.transfer(
        ali.contract_address,
        to_split_uint(10)))
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            ali.contract_address,
            to_split_uint(10)
        )
    )

    await check_balances(100, 100)


@pytest.mark.asyncio
async def test_transfer_from(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    check_balances,
):
    await invoke(ali.contract_address, dai.approve(
        che.contract_address,
        to_split_uint(10)))
    tx = await invoke(che.contract_address, dai.transferFrom(
        ali.contract_address,
        bob.contract_address,
        to_split_uint(10)))
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            bob.contract_address,
            to_split_uint(10)
        )
    )

    await check_balances(90, 110)


@pytest.mark.asyncio
async def test_transfer_to_yourself_using_transfer_from(
    dai: StarknetContract,
    ali: StarknetContract,
):
    tx = await invoke(ali.contract_address, dai.transferFrom(
        ali.contract_address,
        ali.contract_address,
        to_split_uint(10)
    ))
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            ali.contract_address,
            to_split_uint(10)
        )
    )


@ pytest.mark.asyncio
async def test_should_not_transfer_beyond_balance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.transfer(
            bob.contract_address,
            to_split_uint(101),
        ))
    assert "dai/insufficient-balance" in str(err.value)


@ pytest.mark.asyncio
async def test_should_not_transfer_to_zero_address(
    dai: StarknetContract
):
    with pytest.raises(StarkException) as err:
        await dai.transfer(burn, to_split_uint(10)).invoke()
    assert "dai/invalid-recipient" in str(err.value)


@ pytest.mark.asyncio
async def test_should_not_transfer_to_dai_address(
    dai: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await dai.transfer(dai.contract_address, to_split_uint(10)).invoke()
    assert "dai/invalid-recipient" in str(err.value)


@ pytest.mark.asyncio
async def test_mint(
    dai: StarknetContract,
    me: StarknetContract,
    ali: StarknetContract,
    check_balances,
):
    await invoke(me, dai.mint(
        ali.contract_address,
        to_split_uint(10)))

    await check_balances(110, 100)


@ pytest.mark.asyncio
async def test_should_not_allow_minting_to_zero_address(
    dai: StarknetContract,
    me: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(me, dai.mint(
            burn, to_split_uint(10)))
    assert "dai/invalid-recipient" in str(err.value)


@ pytest.mark.asyncio
async def test_should_not_allow_minting_to_dai_address(
    dai: StarknetContract,
    me: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(me, dai.mint(
            dai.contract_address,
            to_split_uint(10),
        ))
    assert "dai/invalid-recipient" in str(err.value)


@ pytest.mark.asyncio
async def test_should_not_allow_minting_to_address_beyond_max(
    dai: StarknetContract,
    me: StarknetContract,
    che: StarknetContract,
):
    assert (await dai.totalSupply().call()).result != (to_split_uint(0),)

    with pytest.raises(StarkException) as err:
        await invoke(me, dai.mint(
            che.contract_address,
            to_split_uint(2**256-1)))
    assert "dai/uint256-overflow" in str(err.value)


@ pytest.mark.asyncio
async def test_burn(
    dai: StarknetContract,
    ali: StarknetContract,
    check_balances,
):
    await invoke(ali.contract_address, dai.burn(
        ali.contract_address,
        to_split_uint(10),
    ))

    await check_balances(90, 100)


@ pytest.mark.asyncio
async def test_should_not_burn_beyond_balance(
    dai: StarknetContract,
    ali: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.burn(
            ali.contract_address,
            to_split_uint(101),
        ))
    assert "dai/insufficient-balance" in str(err.value)


@ pytest.mark.asyncio
async def test_should_not_burn_other(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(bob.contract_address, dai.burn(
            ali.contract_address,
            to_split_uint(10),
        ))
    assert "dai/insufficient-allowance" in str(err.value)


@ pytest.mark.asyncio
async def test_deployer_should_not_be_able_to_burn(
    dai: StarknetContract,
    me: StarknetContract,
    ali: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(me, dai.burn(
            ali.contract_address,
            to_split_uint(10),
        ))
    assert "dai/insufficient-allowance" in str(err.value)


@ pytest.mark.asyncio
async def test_approve(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    tx = await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    check_event(
        dai,
        "Approval",
        tx, (
            ali.contract_address,
            bob.contract_address,
            to_split_uint(10)
        )
    )

    allowance = await call(dai.allowance(
        ali.contract_address,
        bob.contract_address))

    assert allowance == to_split_uint(10)


@ pytest.mark.asyncio
async def test_can_burn_other_if_approved(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    check_balances,
):
    await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    tx = await invoke(bob.contract_address, dai.burn(
        ali.contract_address,
        to_split_uint(10)))
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            0,
            to_split_uint(10)
        )
    )

    await check_balances(90, 100)


# ALLOWANCE
@ pytest.mark.asyncio
async def test_approve_should_not_accept_invalid_amount(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.approve(
            bob.contract_address,
            (2**128, 2**128)))
    assert "dai/invalid-amount" in str(err.value)


@ pytest.mark.asyncio
async def test_decrease_allowance_should_not_accept_invalid_amount(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.decreaseAllowance(
            bob.contract_address,
            (2**128, 2**128)))
    assert "dai/invalid-amount" in str(err.value)


@ pytest.mark.asyncio
async def test_increase_allowance_should_not_accept_invalid_amount(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.increaseAllowance(
            bob.contract_address,
            (2**128, 2**128)))
    assert "dai/invalid-amount" in str(err.value)


@ pytest.mark.asyncio
async def test_approve_should_not_accept_zero_address(
    dai: StarknetContract,
    ali: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.approve(0, to_split_uint(1)))
    assert "dai/invalid-recipient" in str(err.value)


@ pytest.mark.asyncio
async def test_decrease_allowance_should_not_accept_zero_addresses(
    dai: StarknetContract,
    ali: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.decreaseAllowance(0, to_split_uint(0)))
    assert "dai/invalid-recipient" in str(err.value)


@ pytest.mark.asyncio
async def test_increase_allowance_should_not_accept_zero_addresses(
    dai: StarknetContract,
    ali: StarknetContract,
):
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.increaseAllowance(0, to_split_uint(1)))
    assert "dai/invalid-recipient" in str(err.value)

    with pytest.raises(StarkException) as err:
        await invoke(0, dai.increaseAllowance(0, to_split_uint(1)))
    assert "dai/invalid-recipient" in str(err.value)


@ pytest.mark.asyncio
async def test_transfer_using_transfer_from_and_allowance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    check_balances,
):
    await invoke(ali.contract_address, dai.approve(
        che.contract_address,
        to_split_uint(10)))

    await invoke(che.contract_address, dai.transferFrom(
        ali.contract_address,
        bob.contract_address,
        to_split_uint(10),
    ))

    await check_balances(90, 110)


@ pytest.mark.asyncio
async def test_should_not_transfer_beyond_allowance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
):
    await invoke(ali.contract_address, dai.approve(
        che.contract_address,
        to_split_uint(10)))
    allowance = await call(dai.allowance(
        ali.contract_address,
        che.contract_address))

    with pytest.raises(StarkException) as err:
        await invoke(che.contract_address, dai.transferFrom(
            ali.contract_address,
            bob.contract_address,
            to_split_uint(to_uint(allowance)+1),
        ))
    assert "dai/insufficient-allowance" in str(err.value)


@ pytest.mark.asyncio
async def test_burn_using_burn_and_allowance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    check_balances,
):
    await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    tx = await invoke(bob.contract_address, dai.burn(
        ali.contract_address,
        to_split_uint(10)))
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            0,
            to_split_uint(10)
        )
    )

    await check_balances(90, 100)


@ pytest.mark.asyncio
async def test_should_not_burn_beyond_allowance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    allowance = await call(dai.allowance(
        ali.contract_address,
        bob.contract_address))

    with pytest.raises(StarkException) as err:
        await invoke(bob.contract_address, dai.burn(
            ali.contract_address,
            to_split_uint(to_uint(allowance)+1),
        ))
    assert "dai/insufficient-allowance" in str(err.value)


@ pytest.mark.asyncio
async def test_increase_allowance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    await invoke(ali.contract_address, dai.increaseAllowance(
        bob.contract_address,
        to_split_uint(10)))
    allowance = await call(dai.allowance(
        ali.contract_address,
        bob.contract_address))
    assert allowance == to_split_uint(20)


@ pytest.mark.asyncio
async def test_should_not_increase_allowance_beyond_max(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.increaseAllowance(
            bob.contract_address, MAX))
    assert "dai/uint256-overflow" in str(err.value)


@ pytest.mark.asyncio
async def test_decrease_allowance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    await invoke(ali.contract_address, dai.decreaseAllowance(
        bob.contract_address,
        to_split_uint(1)))

    allowance = await call(dai.allowance(
        ali.contract_address,
        bob.contract_address))
    assert allowance == to_split_uint(9)


@ pytest.mark.asyncio
async def test_should_not_decrease_allowance_beyond_allowance(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
):
    await invoke(ali.contract_address, dai.approve(
        bob.contract_address,
        to_split_uint(10)))
    allowance = await call(dai.allowance(
        ali.contract_address,
        bob.contract_address))

    with pytest.raises(StarkException) as err:
        await invoke(ali.contract_address, dai.decreaseAllowance(
            bob.contract_address,
            to_split_uint(to_uint(allowance) + 1),
        ))
    assert "dai/insufficient-allowance" in str(err.value)


# MAXIMUM ALLOWANCE
@ pytest.mark.asyncio
async def test_does_not_decrease_allowance_using_transfer_from(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    check_balances,
):
    await invoke(ali.contract_address, dai.approve(
        che.contract_address, MAX))
    tx = await invoke(che.contract_address, dai.transferFrom(
        ali.contract_address,
        bob.contract_address,
        to_split_uint(10),
    ))
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            bob.contract_address,
            to_split_uint(10)
        )
    )

    allowance = await call(dai.allowance(
        ali.contract_address,
        che.contract_address))
    assert allowance == MAX
    await check_balances(90, 110)


@ pytest.mark.asyncio
async def test_does_not_decrease_allowance_using_burn(
    dai: StarknetContract,
    ali: StarknetContract,
    bob: StarknetContract,
    che: StarknetContract,
    check_balances,
):
    await invoke(ali.contract_address, dai.approve(
        che.contract_address, MAX))
    tx = await invoke(che.contract_address, dai.burn(
        ali.contract_address,
        to_split_uint(10)))
    check_event(
        dai,
        "Transfer",
        tx, (
            ali.contract_address,
            0,
            to_split_uint(10)
        )
    )

    allowance = await call(dai.allowance(
        ali.contract_address,
        che.contract_address))
    assert allowance == MAX
    await check_balances(90, 100)


@ pytest.mark.asyncio
async def test_has_metadata(
    dai: StarknetContract,
):
    name = await call(dai.name())
    assert name == 1386921519817957956156419516361070

    symbol = await call(dai.symbol())
    assert symbol == 4473161

    decimals = await call(dai.decimals())
    assert decimals == 18
