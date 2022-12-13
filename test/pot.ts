import { Account, StarknetContract } from 'hardhat/types';
import { expect } from 'chai';
import hre, { starknet } from 'hardhat';
import fs from 'fs';

import {
  l2Eth,
  simpleDeployL2,
  l2String,
  l2Address,
  invoke,
  uint,
  RAD,
  RAY,
  wad,
  adaptUrl,
  SplitUint,
  WAD,
  DAY,
  blockTimestamp,
  IEventDataEntry,
  assertEvent,
} from './utils';

// https://github.com/makerdao/xdomain-dss/blob/add-end/src/test/Pot.t.sol

const TEST2_ADDRESS = '9379074284324409537785911406195';
const TEST_ADDRESS = '9379074284321109537785911406195';

const dumpFile = 'unittest-dump.dmp';

describe('pot', async function () {
  this.timeout(900_000);
  let admin: Account;
  let _admin: string;
  let ali: any;
  let _ali: string;
  let bob: any;
  let _bob: any;
  let pot: StarknetContract;
  let vat: StarknetContract;
  let deployTimestamp: BigInt;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.address;
    ali = await starknet.deployAccount('OpenZeppelin');
    _ali = ali.starknetContract.address;
    bob = await starknet.deployAccount('OpenZeppelin');
    _bob = bob.starknetContract.address;

    //     vat = new Vat();
    vat = await simpleDeployL2(
      'vat',
      {
        ward: _admin,
      },
      hre
    );

    deployTimestamp = BigInt(await blockTimestamp());

    //     pot = new Pot(address(vat));
    pot = await simpleDeployL2(
      'pot',
      {
        vat: vat.address,
        ward: _admin,
      },
      hre
    );

    //     vat.rely(address(pot));
    await invoke(admin, vat, 'rely', { usr: pot.address });
    //     pot.file("vow", TEST_ADDRESS);
    await invoke(admin, pot, 'file_vow', { what: l2String('vow'), data: TEST_ADDRESS });
    //     vat.suck(address(this), address(this), 100 * RAD);
    await invoke(admin, vat, 'suck', { u: _admin, v: _admin, rad: uint(100n * RAD) });
    //     vat.hope(address(pot));
    await invoke(admin, vat, 'hope', { user: pot.address });

    await starknet.devnet.dump(dumpFile);
  });

  beforeEach(async () => {
    await starknet.devnet.load(dumpFile);
  });

  after(async function () {
    fs.unlink(dumpFile, () => {});
  });

  async function drip() {
    // const { post_fee_amount: daiSent, total_fee: totalFees } = await join.call('requestMint', {
    //   teleportGUID: guid,
    //   max_fee_percentage: l2Eth(maxFeePercentage).res,
    //   operator_fee: l2Eth(operatorFee).res,
    // });
    const txHash = await invoke(admin, pot, 'drip');

    // Check event
    const dripReceipt = await starknet.getTransactionReceipt(txHash);
    assertEvent(dripReceipt, 'Drip', []);

    const hre: any = (starknet.devnet as any).hre;
    const options = {
      feederGatewayUrl: adaptUrl(hre.config.starknet.networkUrl),
      gatewayUrl: adaptUrl(hre.config.starknet.networkUrl),
      hash: txHash,
    };

    const preparedOptions = hre.starknetWrapper.prepareTxQueryOptions(
      'get_transaction_trace',
      options
    );
    const trace = await hre.starknetWrapper.execute('starknet', preparedOptions);
    // const selector = '0x1cf90c76feb7c5a66af63456f5cb56384c258c9ab40ebc62ac1f58f3b3a2fbd';
    const stdout = JSON.parse(trace['stdout']);
    const result = stdout['function_invocation']['internal_calls'][0]['result'].map((v: string) =>
      BigInt(v)
    );
    const tmp = { low: result[0], high: result[1] };
    return tmp;
  }

  async function checkAuth(base: any, contractName: string) {
    const { res: ward } = await base.call('wards', { user: _admin });

    // await GodMode.setWard(base.address, this, 1);

    expect((await base.call('wards', { user: TEST2_ADDRESS })).res).to.equal(0n);

    await invoke(admin, base, 'rely', { usr: TEST2_ADDRESS });

    expect((await base.call('wards', { user: TEST2_ADDRESS })).res).to.equal(1n);

    await invoke(admin, base, 'deny', { usr: TEST2_ADDRESS });

    expect((await base.call('wards', { user: TEST2_ADDRESS })).res).to.equal(0n);

    await invoke(admin, base, 'deny', { usr: _admin });

    try {
      await invoke(admin, base, 'rely', { usr: TEST2_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }
    try {
      await invoke(admin, base, 'deny', { usr: TEST2_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }

    // await GodMode.setWard(base.address, this, ward);
  }

  // function testConstructor() public {
  it('test constructor', async () => {
    //     assertEq(address(pot.vat()), address(vat));
    expect(l2Address((await pot.call('vat')).res)).to.be.equal(vat.address);
    //     assertEq(pot.wards(address(this)), 1);
    expect((await pot.call('wards', { user: _admin })).res).to.be.equal(1n);
    //     assertEq(pot.dsr(), RAY);
    expect((await pot.call('dsr')).res).to.deep.equal(uint(RAY));
    //     assertEq(pot.chi(), RAY);
    expect((await pot.call('chi')).res).to.deep.equal(uint(RAY));
    //     assertEq(pot.rho(), block.timestamp);
    expect((await pot.call('rho')).res).to.be.equal(deployTimestamp);
    //     assertEq(pot.live(), 1);
    expect((await pot.call('live')).res).to.be.equal(1n);
  });

  // function testAuth() public {
  it('test auth', async () => {
    //     checkAuth(address(pot), "Pot");
    await checkAuth(pot, 'Pot');
  });

  // function testFile() public {
  it('test file', async () => {
    //     checkFileUint(address(pot), "Pot", ["dsr"]);
    //     checkFileAddress(address(pot), "Pot", ["vow"]);
  });

  // function testFileNotLive() public {
  it('test file not live', async () => {
    //     pot.cage();
    await invoke(admin, pot, 'cage');
    try {
      //     pot.file("dsr", 1);
      await invoke(admin, pot, 'file', { what: l2String('dsr'), data: uint(1n) });
    } catch (err: any) {
      //     vm.expectRevert("Pot/not-live");
      expect(err.message).to.contain('Pot/not-live');
    }
  });

  // function testFileRhoNotUpdated() public {
  it('test file rho not updated', async () => {
    //     vm.warp(block.timestamp + 1);

    await starknet.devnet.increaseTime(1);
    await starknet.devnet.createBlock();

    try {
      //     pot.file("dsr", 1);
      await invoke(admin, pot, 'file', { what: l2String('dsr'), data: uint(1n) });
    } catch (err: any) {
      //     vm.expectRevert("Pot/rho-not-updated");
      expect(err.message).to.contain('Pot/rho-not-updated');
    }
  });

  // function testCage() public {
  it('test cage', async () => {
    //     pot.file("dsr", 123);
    await invoke(admin, pot, 'file', { what: l2String('dsr'), data: uint(123n) });

    //     assertEq(pot.live(), 1);
    expect((await pot.call('live')).res).to.be.equal(1n);

    //     assertEq(pot.dsr(), 123);
    expect((await pot.call('dsr')).res).to.deep.equal(uint(123n));

    //     vm.expectEmit(true, true, true, true);
    //     emit Cage();
    //     pot.cage();
    let txHash = await invoke(admin, pot, 'cage');
    const cageReceipt = await starknet.getTransactionReceipt(txHash);
    assertEvent(cageReceipt, 'Cage', []);

    //     assertEq(pot.live(), 0);
    expect((await pot.call('live')).res).to.be.equal(0n);

    //     assertEq(pot.dsr(), RAY);
    expect((await pot.call('dsr')).res).to.deep.equal(uint(RAY));
  });

  // function testDrip() public {
  it('test drip', async () => {
    //     pot.join(100 * WAD);
    await invoke(admin, pot, 'join', { wad: wad(100n) });
    //     pot.file("dsr", 1000000564701133626865910626);  // 5% / day
    await invoke(admin, pot, 'file', {
      what: l2String('dsr'),
      data: uint(1000000564701133626865910626n),
    });
    //     assertEq(pot.chi(), RAY);
    expect((await pot.call('chi')).res).to.deep.equal(uint(RAY));
    //     assertEq(pot.rho(), block.timestamp);
    let timestamp = (await starknet.getBlock()).timestamp;
    expect((await pot.call('rho')).res).to.be.equal(BigInt(timestamp));
    //     assertEq(vat.sin(TEST_ADDRESS), 0);
    //     assertEq(vat.dai(address(pot)), 100 * RAD);
    expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(uint(0n));
    expect((await vat.call('dai', { u: pot.address })).res).to.deep.equal(uint(100n * RAD));
    //     vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     vm.expectEmit(true, true, true, true);
    //     emit Drip();
    //     uint256 chi_ = pot.drip();
    let chi_ = await drip();
    //     assertEq(pot.chi(), 1050000000000000000000016038);
    expect((await pot.call('chi')).res).to.deep.equal(uint(1050000000000000000000016038n));
    //     assertEq(pot.chi(), chi_);
    expect((await pot.call('chi')).res).to.deep.equal(chi_);
    //     assertEq(pot.rho(), block.timestamp);
    timestamp = await blockTimestamp();
    expect((await pot.call('rho')).res).to.be.equal(BigInt(timestamp));
    //     assertEq(vat.sin(TEST_ADDRESS), 5000000000000000000001603800000000000000000000);
    //     assertEq(vat.dai(address(pot)), 105000000000000000000001603800000000000000000000);
    expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(
      uint(5000000000000000000001603800000000000000000000n)
    );
    expect((await vat.call('dai', { u: pot.address })).res).to.deep.equal(
      uint(105000000000000000000001603800000000000000000000n)
    );
  });

  // function testJoin() public {
  it('test join', async () => {
    //     assertEq(vat.dai(address(this)), 100 * RAD);
    //     assertEq(pot.pie(address(this)), 0);
    //     assertEq(pot.Pie(), 0);
    expect(await vat.call('dai', { u: _admin })).to.deep.equal(l2Eth(100n * RAD));
    expect(await pot.call('pie', { u: _admin })).to.deep.equal(l2Eth(0n));
    expect(await pot.call('Pie')).to.deep.equal(l2Eth(0n));
    //     vm.expectEmit(true, true, true, true);
    //     emit Join(address(this), 100 * WAD);
    //     pot.join(100 * WAD);
    let txHash = await invoke(admin, pot, 'join', { wad: wad(100n) });
    const joinReceipt = await starknet.getTransactionReceipt(txHash);
    const eventDataJoin: IEventDataEntry[] = [
      { data: _admin, isAddress: true },
      { data: uint(100n * WAD) },
    ];
    assertEvent(joinReceipt, 'Join', eventDataJoin);
    //     assertEq(vat.dai(address(this)), 0);
    //     assertEq(pot.pie(address(this)), 100 * WAD);
    //     assertEq(pot.Pie(), 100 * WAD);
    expect(await vat.call('dai', { u: _admin })).to.deep.equal(l2Eth(100n * RAD));
    expect((await pot.call('pie', { u: _admin })).res).to.deep.equal(wad(100n));
    expect((await pot.call('Pie')).res).to.deep.equal(wad(100n));
  });

  // function testJoinRhoNotUpdated() public {
  it('test join rho not updated', async () => {
    //     vm.warp(block.timestamp + 1);
    await starknet.devnet.increaseTime(1);
    await starknet.devnet.createBlock();

    try {
      //     pot.join(100 * WAD);
      await invoke(admin, pot, 'join', { wad: wad(100n) });
    } catch (err: any) {
      //     vm.expectRevert("Pot/rho-not-updated");
      expect(err.message).to.contain('Pot/rho-not-updated');
    }
  });

  // function testExit() public {
  it('test exit', async () => {
    //     pot.join(100 * WAD);
    await invoke(admin, pot, 'join', { wad: wad(100n) });

    //     assertEq(vat.dai(address(this)), 0);
    //     assertEq(pot.pie(address(this)), 100 * WAD);
    //     assertEq(pot.Pie(), 100 * WAD);
    expect(await vat.call('dai', { u: _admin })).to.deep.equal(l2Eth(0n));
    expect((await pot.call('pie', { u: _admin })).res).to.deep.equal(wad(100n));
    expect((await pot.call('Pie')).res).to.deep.equal(wad(100n));

    //     vm.expectEmit(true, true, true, true);
    //     emit Exit(address(this), 100 * WAD);
    //     pot.exit(100 * WAD);
    let txHash = await invoke(admin, pot, 'exit', { wad: wad(100n) });
    const exitReceipt = await starknet.getTransactionReceipt(txHash);
    const eventDataExit: IEventDataEntry[] = [
      { data: _admin, isAddress: true },
      { data: uint(100n * WAD) },
    ];
    assertEvent(exitReceipt, 'Exit', eventDataExit);
    //     assertEq(vat.dai(address(this)), 100 * RAD);
    //     assertEq(pot.pie(address(this)), 0);
    //     assertEq(pot.Pie(), 0);
    expect(await vat.call('dai', { u: _admin })).to.deep.equal(l2Eth(100n * RAD));
    expect((await pot.call('pie', { u: _admin })).res).to.deep.equal(wad(0n));
    expect((await pot.call('Pie')).res).to.deep.equal(wad(0n));
  });

  // function testSave0d() public {
  it('test save0d', async () => {
    //     pot.join(100 * WAD);
    await invoke(admin, pot, 'join', { wad: wad(100n) });
    //     assertEq(vat.dai(address(this)), 0);
    //     assertEq(pot.pie(address(this)), 100 * WAD);
    expect(await vat.call('dai', { u: _admin })).to.deep.equal(l2Eth(0n));
    expect((await pot.call('pie', { u: _admin })).res).to.deep.equal(wad(100n));
    //     pot.drip();
    await drip();
    //     pot.exit(100 * WAD);
    await invoke(admin, pot, 'exit', { wad: wad(100n) });
    //     assertEq(vat.dai(address(this)), 100 * RAD);
    expect(await vat.call('dai', { u: _admin })).to.deep.equal(l2Eth(100n * RAD));
  });

  // function testSave1d() public {
  it('test save1d', async () => {
    //     pot.join(100 * WAD);
    await invoke(admin, pot, 'join', { wad: wad(100n) });
    //     pot.file("dsr", uint256(1000000564701133626865910626));  // 5% / day
    await invoke(admin, pot, 'file', {
      what: l2String('dsr'),
      data: uint(1000000564701133626865910626n),
    });
    //     vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     pot.drip();
    await drip();
    //     assertEq(pot.pie(address(this)), 100 * WAD);
    expect((await pot.call('pie', { u: _admin })).res).to.deep.equal(wad(100n));
    //     pot.exit(100 * WAD);
    await invoke(admin, pot, 'exit', { wad: wad(100n) });
    //     assertEq(vat.dai(address(this)), 105000000000000000000001603800000000000000000000);
    expect(await vat.call('dai', { u: _admin })).to.deep.equal(
      l2Eth(105000000000000000000001603800000000000000000000n)
    );
  });

  // function testDripMulti() public {
  it('test drip multi', async () => {
    //     pot.join(100 * WAD);
    await invoke(admin, pot, 'join', { wad: wad(100n) });
    //     pot.file("dsr", uint256(1000000564701133626865910626));  // 5% / day
    await invoke(admin, pot, 'file', {
      what: l2String('dsr'),
      data: uint(1000000564701133626865910626n),
    });
    //     vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     pot.drip();
    await drip();
    //     assertEq(vat.dai(address(pot)), 105000000000000000000001603800000000000000000000);
    expect(await vat.call('dai', { u: pot.address })).to.deep.equal(
      l2Eth(105000000000000000000001603800000000000000000000n)
    );
    //     pot.file("dsr", uint256(1000001103127689513476993127));  // 10% / day
    await invoke(admin, pot, 'file', {
      what: l2String('dsr'),
      data: uint(1000001103127689513476993127n),
    });
    //     vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     pot.drip();
    await drip();
    //     assertEq(vat.sin(TEST_ADDRESS), 15500000000000000000006151700000000000000000000);
    //     assertEq(vat.dai(address(pot)), 115500000000000000000006151700000000000000000000);
    expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(
      uint(15500000000000000000006151700000000000000000000n)
    );
    expect((await vat.call('dai', { u: pot.address })).res).to.deep.equal(
      uint(115500000000000000000006151700000000000000000000n)
    );
    //     assertEq(pot.Pie(), 100 * WAD);
    expect((await pot.call('Pie')).res).to.deep.equal(wad(100n));
    //     assertEq(pot.chi() / 10 ** 9, 1155 * WAD / 1000);
    let { res: chi_ } = await pot.call('chi');
    let chi = new SplitUint(chi_).toUint() / 10n ** 9n;
    expect(chi).to.equal((1155n * WAD) / 1000n);
  });

  // function testDripMultiInBlock() public {
  it('test drip multi in block', async () => {
    //     pot.drip();
    await drip();
    //     uint256 rho = pot.rho();
    let { res: rho } = await pot.call('rho');
    //     assertEq(rho, block.timestamp);
    let timestamp = await blockTimestamp();
    expect(rho).to.equal(BigInt(timestamp));
    //     vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     rho = pot.rho();
    rho = (await pot.call('rho')).res;
    //     assertEq(rho, block.timestamp - 1 days);
    timestamp = await blockTimestamp();
    expect(rho).to.equal(BigInt(timestamp) - BigInt(DAY));
    //     pot.drip();
    await drip();
    //     rho = pot.rho();
    rho = (await pot.call('rho')).res;
    //     assertEq(rho, block.timestamp);
    timestamp = await blockTimestamp();
    expect(rho).to.equal(BigInt(timestamp));
    //     pot.drip();
    await drip();
    //     rho = pot.rho();
    rho = (await pot.call('rho')).res;
    //     assertEq(rho, block.timestamp);
    timestamp = await blockTimestamp();
    expect(rho).to.equal(BigInt(timestamp));
  });

  // function testSaveMulti() public {
  it('test save multi', async () => {
    //     pot.join(100 * WAD);
    await invoke(admin, pot, 'join', { wad: wad(100n) });

    //     pot.file("dsr", uint256(1000000564701133626865910626));  // 5% / day
    await invoke(admin, pot, 'file', {
      what: l2String('dsr'),
      data: uint(1000000564701133626865910626n),
    });
    //     vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     pot.drip();
    await drip();
    //     pot.exit(50 * WAD);
    await invoke(admin, pot, 'exit', { wad: wad(50n) });
    //     assertEq(vat.dai(address(this)), 52500000000000000000000801900000000000000000000);
    expect((await vat.call('dai', { u: _admin })).res).to.deep.equal(
      uint(52500000000000000000000801900000000000000000000n)
    );
    //     assertEq(pot.Pie(), 50 * WAD);
    expect((await pot.call('Pie')).res).to.deep.equal(wad(50n));
    //     pot.file("dsr", uint256(1000001103127689513476993127));  // 10% / day
    await invoke(admin, pot, 'file', {
      what: l2String('dsr'),
      data: uint(1000001103127689513476993127n),
    });
    //     vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     pot.drip();
    await drip();
    //     pot.exit(50 * WAD);
    await invoke(admin, pot, 'exit', { wad: wad(50n) });
    //     assertEq(vat.dai(address(this)), 110250000000000000000003877750000000000000000000);
    expect((await vat.call('dai', { u: _admin })).res).to.deep.equal(
      uint(110250000000000000000003877750000000000000000000n)
    );
    //     assertEq(pot.Pie(), 0);
    expect((await pot.call('Pie')).res).to.deep.equal(wad(0n));
  });

  // function testFreshChi() public {
  it('test fresh chi', async () => {
    //     uint256 rho = pot.rho();
    let { res: rho } = await pot.call('rho');
    //     assertEq(rho, block.timestamp);
    let timestamp = await blockTimestamp();
    expect(Number(rho)).to.equal(BigInt(timestamp));
    //     vm.warp(block.timestamp + 1 days);
    //     assertEq(rho, block.timestamp - 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    //     pot.drip();
    await drip();
    //     pot.join(100 * WAD);
    await invoke(admin, pot, 'join', { wad: wad(100n) });
    //     assertEq(pot.pie(address(this)), 100 * WAD);
    expect((await pot.call('pie', { u: _admin })).res).to.deep.equal(wad(100n));
    //     pot.exit(100 * WAD);
    await invoke(admin, pot, 'exit', { wad: wad(100n) });
    // if we exit in the same transaction we should not earn DSR
    //     assertEq(vat.dai(address(this)), 100 * RAD);
    expect((await vat.call('dai', { u: _admin })).res).to.deep.equal(uint(100n * RAD));
  });
});
