import { expect } from 'chai';
import hre, { starknet } from 'hardhat';

import { l2Eth, simpleDeployL2, SplitUint } from './utils';

const initialBalanceThis = l2Eth(1000n);
const initialBalanceCal = l2Eth(100n);

const MAX = 2n ** 256n - 1n;

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
      amount: initialBalanceThis.res,
    });
    await admin.invoke(dai, 'mint', {
      account: _user2,
      amount: initialBalanceCal.res,
    });

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('unittest-dump.dmp');
  });

  it('test setup precondition', async () => {
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(l2Eth(1000n));
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
      l2Eth(0n)
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
      amount: sentAmount.res,
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

  it('test approve sets allowance', async () => {
    await user1.invoke(dai, 'approve', { spender: _user2, amount: l2Eth(25n).res });
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(25n)
    );
  });

  it('charges amount approved', async () => {
    const amountApproved = l2Eth(20n);
    await user1.invoke(dai, 'approve', { spender: _user2, amount: amountApproved.res });
    await user2.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: amountApproved.res,
    });
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(amountApproved);
  });

  it('fail transfer without approval', async () => {
    try {
      await admin.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user2,
        amount: l2Eth(1n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });

  it('fail charge more than approved', async () => {
    const amountApproved = l2Eth(20n);
    try {
      await user1.invoke(dai, 'approve', { spender: _user2, amount: amountApproved.res });
      await user2.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _admin,
        amount: l2Eth(21n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });

  it('test transfer from self', async () => {
    await user1.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: l2Eth(50n).res,
    });
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(50n));
  });

  it('test fail transfer from self non arbitrary size', async () => {
    // you shouldn't be able to evade balance checks by transferring
    // to yourself
    const _balance: SplitUint = (await dai.call('balanceOf', { user: _admin })) as SplitUint;
    try {
      await user1.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user1,
        amount: l2Eth(1001n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-balance');
    }
  });

  it('test mint self', async () => {
    const mintAmount = l2Eth(10n);
    await admin.invoke(dai, 'mint', { account: _admin, amount: mintAmount.res });
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(mintAmount);
  });

  it('test mint guy', async () => {
    const mintAmount = l2Eth(10n);
    await admin.invoke(dai, 'mint', { account: _user1, amount: mintAmount.res });
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(
      mintAmount.add(initialBalanceThis)
    );
  });

  it('test fail mint guy no auth', async () => {
    const mintAmount = l2Eth(10n);
    try {
      await user1.invoke(dai, 'mint', { account: _user1, amount: mintAmount.res });
    } catch (err: any) {
      expect(err.message).to.contain('dai/not-authorized');
    }
  });

  it('test mint guy auth', async () => {
    const mintAmount = l2Eth(10n);
    await admin.invoke(dai, 'rely', { user: _user1 });
    await user1.invoke(dai, 'mint', { account: _user1, amount: mintAmount.res });
  });

  it('test burn', async () => {
    const burnAmount = l2Eth(10n);
    await user1.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
    expect(await dai.call('totalSupply')).to.deep.equal(
      initialBalanceThis.add(initialBalanceCal).sub(burnAmount)
    );
  });

  it('test burn self', async () => {
    const burnAmount = l2Eth(10n);
    await user1.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(
      initialBalanceThis.sub(burnAmount)
    );
  });

  it('test burn guy with trust', async () => {
    const burnAmount = l2Eth(10n);
    await user1.invoke(dai, 'approve', { spender: _admin, amount: burnAmount.res });
    await admin.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(
      initialBalanceThis.sub(burnAmount)
    );
  });

  it('test burn auth', async () => {
    const burnAmount = l2Eth(10n);
    await admin.invoke(dai, 'rely', { user: _user1 });
    await user1.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
  });

  it('test fail untrusted transfer from', async () => {
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(0n)
    );
    try {
      await admin.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user2,
        amount: l2Eth(200n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });

  it('test trusting', async () => {
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(0n)
    );
    await user1.invoke(dai, 'approve', {
      spender: _user2,
      amount: l2Eth(MAX).res,
    });
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(MAX)
    );
    await user1.invoke(dai, 'approve', {
      spender: _user2,
      amount: l2Eth(0n).res,
    });
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(0n)
    );
  });

  it('test trusted transfer from', async () => {
    await user1.invoke(dai, 'approve', {
      spender: _admin,
      amount: l2Eth(MAX).res,
    });
    await admin.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _user2,
      amount: l2Eth(200n).res,
    });
    expect(await dai.call('balanceOf', { user: _user2 })).to.deep.equal(l2Eth(300n));
  });

  it('test approve will modify allowance', async () => {
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(0n)
    );
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(0n));
    await user1.invoke(dai, 'approve', {
      spender: _admin,
      amount: l2Eth(1000n).res,
    });
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(1000n)
    );
    await admin.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: l2Eth(500n).res,
    });
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(500n));
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(500n)
    );
  });

  it('test approve will not modify allowance', async () => {
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(0n)
    );
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(0n));
    await user1.invoke(dai, 'approve', {
      spender: _admin,
      amount: l2Eth(MAX).res,
    });
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(MAX)
    );
    await admin.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: l2Eth(1000n).res,
    });
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(1000n));
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(MAX)
    );
  });
});
