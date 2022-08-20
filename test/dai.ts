import { expect } from 'chai';
import hre, { starknet } from 'hardhat';

import { asDec, eth, l2Eth, simpleDeployL2, SplitUint, toBytes32, l2String, logGas } from './utils';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('dai', async function () {
  this.timeout(900_000);
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let dai: any;

  before(async () => {
    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;
    dai = await simpleDeployL2(
      'dai',
      {
        ward: _admin,
      },
      hre
    );

    // Mint initial balances
    await admin.invoke(dai, 'mint', {
      account: _user1,
      amount: { low: l2Eth(1000n).toDec()[0], high: l2Eth(1000n).toDec()[1] },
    });
    await admin.invoke(dai, 'mint', {
      account: _user2,
      amount: { low: l2Eth(100n).toDec()[0], high: l2Eth(100n).toDec()[1] },
    });

    await starknet.devnet.dump('dump.pkl');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('dump.pkl');
  });

  it('test setup precondition', async () => {
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(SplitUint.fromUint(1000n));
  });

  it('test transfer cost', async () => {
    // await logGas(
    //   'transfer',
    //   user1.invoke(dai, 'transfer', {
    //     recipient: _user2,
    //     amount: { low: l2Eth(10n).toDec()[0], high: l2Eth(10n).toDec()[1] },
    //   })
    // );
  });

  it('test allowance starts at zero', async () => {
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      SplitUint.fromUint(0n)
    );
  });

  it('test valid transfers', async () => {
    // uint sentAmount = 250;
    //     emit log_named_address("token11111", address(token));
    //     token.transfer(user2, sentAmount);
    //     assertEq(token.balanceOf(user2), sentAmount);
    //     assertEq(token.balanceOf(self), initialBalanceThis - sentAmount);
    const sentAmount = l2Eth(250n);
    await user1.invoke(dai, 'transfer', {
      recipient: _admin,
      amount: { low: sentAmount.toDec()[0], high: sentAmount.toDec()[1] },
    });
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(sentAmount);
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(l2Eth(750n)); // 1000 - 250
  });

  it('test fail wrong account transfers', async () => {
    const sentAmount = l2Eth(250n);
    try {
      await admin.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user2,
        amount: sentAmount.res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });

  it('test fail insufficient funds transfers', async () => {
    try {
      await user1.invoke(dai, 'transfer', {
        recipient: _admin,
        amount: l2Eth(750n).res,
      });
      await user1.invoke(dai, 'transfer', {
        recipient: _user2,
        amount: l2Eth(251n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-balance');
    }
  });
});
