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

  // function testAllowanceStartsAtZero() public logs_gas {
  it('test allowance starts at zero', async () => {
    // assertEq(token.allowance(user1, user2), 0);
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(0n)
    );
  });

  // function testValidTransfers() public logs_gas {
  it('test valid transfers', async () => {
    // uint sentAmount = 250;
    // emit log_named_address("token11111", address(token));
    // token.transfer(user2, sentAmount);
    const sentAmount = l2Eth(250n);
    await user1.invoke(dai, 'transfer', {
      recipient: _admin,
      amount: sentAmount.res,
    });
    // assertEq(token.balanceOf(user2), sentAmount);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(sentAmount);
    // assertEq(token.balanceOf(self), initialBalanceThis - sentAmount);
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(l2Eth(750n)); // 1000 - 250
  });

  // function testFailWrongAccountTransfers() public logs_gas {
  it('test fail wrong account transfers', async () => {
    //  uint sentAmount = 250;
    const sentAmount = l2Eth(250n);
    try {
      // token.transferFrom(user2, self, sentAmount);
      await admin.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user2,
        amount: sentAmount.res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });

  // function testFailInsufficientFundsTransfers() public logs_gas {
  it('test fail insufficient funds transfers', async () => {
    try {
      // uint sentAmount = 250;
      const sentAmount = 250n;
      // token.transfer(user1, initialBalanceThis - sentAmount);
      await user1.invoke(dai, 'transfer', {
        recipient: _admin,
        amount: l2Eth(750n).res,
      });
      // token.transfer(user2, sentAmount + 1);
      await user1.invoke(dai, 'transfer', {
        recipient: _user2,
        amount: l2Eth(sentAmount + 1n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-balance');
    }
  });
  //  function testApproveSetsAllowance() public logs_gas {
  it('test approve sets allowance', async () => {
    // token.approve(user2, 25);
    await user1.invoke(dai, 'approve', { spender: _user2, amount: l2Eth(25n).res });
    // assertEq(token.allowance(self, user2), 25);
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(25n)
    );
  });

  // function testChargesAmountApproved() public logs_gas {
  it('charges amount approved', async () => {
    // uint amountApproved = 20;
    const amountApproved = l2Eth(20n);
    // token.approve(user2, amountApproved);
    await user1.invoke(dai, 'approve', { spender: _user2, amount: amountApproved.res });
    // assertTrue(TokenUser(user2).doTransferFrom(self, user2, amountApproved));
    await user2.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: amountApproved.res,
    });
    // assertEq(token.balanceOf(self), initialBalanceThis - amountApproved);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(amountApproved);
  });

  // function testFailTransferWithoutApproval() public logs_gas {
  it('fail transfer without approval', async () => {
    try {
      // token.transfer(user1, 50);
      // token.transferFrom(user1, self, 1);
      await admin.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user2,
        amount: l2Eth(1n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });

  // function testFailChargeMoreThanApproved() public logs_gas {
  it('fail charge more than approved', async () => {
    const amountApproved = l2Eth(20n);
    try {
      // TokenUser(user1).doApprove(self, 20);
      await user1.invoke(dai, 'approve', { spender: _user2, amount: amountApproved.res });
      // token.transferFrom(user1, self, 21);
      await user2.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _admin,
        amount: l2Eth(21n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });

  // function testTransferFromSelf() public {
  it('test transfer from self', async () => {
    // token.transferFrom(self, user1, 50);
    await user1.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: l2Eth(50n).res,
    });
    // assertEq(token.balanceOf(user1), 50);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(50n));
  });

  // function testFailTransferFromSelfNonArbitrarySize() public {
  it('test fail transfer from self non arbitrary size', async () => {
    // you shouldn't be able to evade balance checks by transferring
    // to yourself
    try {
      // token.transferFrom(self, self, token.balanceOf(self) + 1);
      await user1.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user1,
        amount: l2Eth(1001n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-balance');
    }
  });

  // function testMintself() public {
  it('test mint self', async () => {
    // uint mintAmount = 10;
    const mintAmount = l2Eth(10n);
    // token.mint(address(this), mintAmount);
    await admin.invoke(dai, 'mint', { account: _admin, amount: mintAmount.res });
    // assertEq(token.balanceOf(self), initialBalanceThis + mintAmount);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(mintAmount);
  });

  // function testMintGuy() public {
  it('test mint guy', async () => {
    // uint mintAmount = 10;
    const mintAmount = l2Eth(10n);
    // token.mint(user1, mintAmount);
    await admin.invoke(dai, 'mint', { account: _user1, amount: mintAmount.res });
    // assertEq(token.balanceOf(user1), mintAmount);
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(
      mintAmount.add(initialBalanceThis)
    );
  });

  // function testFailMintGuyNoAuth() public {
  it('test fail mint guy no auth', async () => {
    const mintAmount = l2Eth(10n);
    try {
      // TokenUser(user1).doMint(user2, 10);
      await user1.invoke(dai, 'mint', { account: _user1, amount: mintAmount.res });
    } catch (err: any) {
      expect(err.message).to.contain('dai/not-authorized');
    }
  });

  // function testMintGuyAuth() public {
  it('test mint guy auth', async () => {
    const mintAmount = l2Eth(10n);
    // token.rely(user1);
    await admin.invoke(dai, 'rely', { user: _user1 });
    // TokenUser(user1).doMint(user2, 10);
    await user1.invoke(dai, 'mint', { account: _user1, amount: mintAmount.res });
  });

  // function testBurn() public {
  it('test burn', async () => {
    // uint burnAmount = 10;
    const burnAmount = l2Eth(10n);
    // token.burn(address(this), burnAmount);
    await user1.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
    // assertEq(token.totalSupply(), initialBalanceThis + initialBalanceCal - burnAmount);
    expect(await dai.call('totalSupply')).to.deep.equal(
      initialBalanceThis.add(initialBalanceCal).sub(burnAmount)
    );
  });
  //  function testBurnself() public {
  it('test burn self', async () => {
    // uint burnAmount = 10;
    const burnAmount = l2Eth(10n);
    // token.burn(address(this), burnAmount);
    await user1.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
    // assertEq(token.balanceOf(self), initialBalanceThis - burnAmount);
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(
      initialBalanceThis.sub(burnAmount)
    );
  });
  // function testBurnGuyWithTrust() public {
  it('test burn guy with trust', async () => {
    // uint burnAmount = 10;
    // token.transfer(user1, burnAmount);
    // assertEq(token.balanceOf(user1), burnAmount);
    const burnAmount = l2Eth(10n);
    // TokenUser(user1).doApprove(self);
    await user1.invoke(dai, 'approve', { spender: _admin, amount: burnAmount.res });
    // token.burn(user1, burnAmount);
    await admin.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
    // assertEq(token.balanceOf(user1), 0);
    expect(await dai.call('balanceOf', { user: _user1 })).to.deep.equal(
      initialBalanceThis.sub(burnAmount)
    );
  });
  // function testBurnAuth() public {
  it('test burn auth', async () => {
    const burnAmount = l2Eth(10n);
    await admin.invoke(dai, 'rely', { user: _user1 });
    await user1.invoke(dai, 'burn', { account: _user1, amount: burnAmount.res });
  });

  // function testBurnGuyAuth() public {
  it('test burn guy auth', async () => {
    // token.transfer(user2, 10);
    await admin.invoke(dai, 'transferFrom', {
      sender: _admin,
      recipient: _user2,
      amount: l2Eth(10n).res,
    });
    // TokenUser(user2).doApprove(user1);
    await user2.invoke(dai, 'approve', { spender: _user1, amount: l2Eth(10n).res });
    // TokenUser(user1).doBurn(user2, 10);
    await user1.invoke(dai, 'burn', { account: _user2, amount: l2Eth(10n).res });
  });

  // function testFailUntrustedTransferFrom() public {
  it('test fail untrusted transfer from', async () => {
    // assertEq(token.allowance(self, user2), 0);
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(0n)
    );
    try {
      // TokenUser(user1).doTransferFrom(self, user2, 200);
      await admin.invoke(dai, 'transferFrom', {
        sender: _user1,
        recipient: _user2,
        amount: l2Eth(200n).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('dai/insufficient-allowance');
    }
  });
  // function testTrusting() public {
  it('test trusting', async () => {
    // assertEq(token.allowance(self, user2), 0);
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(0n)
    );
    // token.approve(user2, uint(-1));
    await user1.invoke(dai, 'approve', {
      spender: _user2,
      amount: l2Eth(MAX).res,
    });
    // assertEq(token.allowance(self, user2), uint(-1));
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(MAX)
    );
    // token.approve(user2, 0);
    await user1.invoke(dai, 'approve', {
      spender: _user2,
      amount: l2Eth(0n).res,
    });
    // assertEq(token.allowance(self, user2), 0);
    expect(await dai.call('allowance', { owner: _user1, spender: _user2 })).to.deep.equal(
      l2Eth(0n)
    );
  });
  // function testTrustedTransferFrom() public {
  it('test trusted transfer from', async () => {
    //  token.approve(user1, uint(-1));
    await user1.invoke(dai, 'approve', {
      spender: _admin,
      amount: l2Eth(MAX).res,
    });
    // TokenUser(user1).doTransferFrom(self, user2, 200);
    await admin.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _user2,
      amount: l2Eth(200n).res,
    });
    // assertEq(token.balanceOf(user2), 200);
    expect(await dai.call('balanceOf', { user: _user2 })).to.deep.equal(l2Eth(300n));
  });
  // function testApproveWillModifyAllowance() public {
  it('test approve will modify allowance', async () => {
    // assertEq(token.allowance(self, user1), 0);
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(0n)
    );
    // assertEq(token.balanceOf(user1), 0);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(0n));
    // token.approve(user1, 1000);
    await user1.invoke(dai, 'approve', {
      spender: _admin,
      amount: l2Eth(1000n).res,
    });
    // assertEq(token.allowance(self, user1), 1000);
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(1000n)
    );
    // TokenUser(user1).doTransferFrom(self, user1, 500);
    await admin.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: l2Eth(500n).res,
    });
    // assertEq(token.balanceOf(user1), 500);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(500n));
    // assertEq(token.allowance(self, user1), 500);
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(500n)
    );
  });
  // function testApproveWillNotModifyAllowance() public {
  it('test approve will not modify allowance', async () => {
    // assertEq(token.allowance(self, user1), 0);
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(0n)
    );
    // assertEq(token.balanceOf(user1), 0);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(0n));
    // token.approve(user1, uint(-1));
    await user1.invoke(dai, 'approve', {
      spender: _admin,
      amount: l2Eth(MAX).res,
    });
    // assertEq(token.allowance(self, user1), uint(-1));
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(MAX)
    );
    // TokenUser(user1).doTransferFrom(self, user1, 1000);
    await admin.invoke(dai, 'transferFrom', {
      sender: _user1,
      recipient: _admin,
      amount: l2Eth(1000n).res,
    });
    // assertEq(token.balanceOf(user1), 1000);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(1000n));
    // assertEq(token.allowance(self, user1), uint(-1));
    expect(await dai.call('allowance', { owner: _user1, spender: _admin })).to.deep.equal(
      l2Eth(MAX)
    );
  });
});
