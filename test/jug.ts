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
  SplitUintType,
  eth,
  blockTimestamp,
  DAY,
} from './utils';

// https://github.com/makerdao/xdomain-dss/blob/add-end/src/test/Jug.t.sol

const TEST2_ADDRESS = '9379074284324409537785911406195';
const TEST_ADDRESS = '9379074284321109537785911406195';

const dumpFile = 'unittest-dump.dmp';

const ILK = l2String('SOME-ILK-A');

describe('jug', async function () {
  this.timeout(900_000);
  let admin: Account;
  let _admin: string;
  let ali: any;
  let _ali: string;
  let bob: any;
  let _bob: any;
  let jug: StarknetContract;
  let vat: StarknetContract;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.address;
    ali = await starknet.deployAccount('OpenZeppelin');
    _ali = ali.starknetContract.address;
    bob = await starknet.deployAccount('OpenZeppelin');
    _bob = bob.starknetContract.address;

    //         vat  = new Vat();
    vat = await simpleDeployL2(
      'vat',
      {
        ward: _admin,
      },
      hre
    );
    //         vm.expectEmit(true, true, true, true);
    //         emit Rely(address(this));
    //         jug = new Jug(address(vat));
    jug = await simpleDeployL2('jug', { vat_: vat.address, ward_: _admin }, hre);
    //         vat.rely(address(jug));
    await invoke(admin, vat, 'rely', { usr: jug.address });
    //         vat.init(ILK);
    await invoke(admin, vat, 'init', { ilk: ILK });
    //         vat.file("Line", 100 * RAD);
    //         vat.file(ILK, "line", 100 * RAD);
    //         vat.file(ILK, "spot", RAY);
    await invoke(admin, vat, 'file', {
      what: l2String('Line'),
      data: uint(100n * RAD),
    });
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: l2String('line'),
      data: uint(100n * RAD),
    });
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: l2String('spot'),
      data: uint(RAY),
    });
    //         vat.slip(ILK, address(this), int256(100 * WAD));
    await invoke(admin, vat, 'slip', {
      ilk: ILK,
      usr: _admin,
      wad: wad(100n),
    });
    //         vat.frob(ILK, address(this), address(this), address(this), int256(100 * WAD), int256(100 * WAD));
    await invoke(admin, vat, 'frob', {
      i: ILK,
      u: _admin,
      v: _admin,
      w: _admin,
      dink: wad(100n),
      dart: wad(100n),
    });

    await starknet.devnet.dump(dumpFile);
  });

  beforeEach(async () => {
    await starknet.devnet.load(dumpFile);
  });

  after(async function () {
    fs.unlink(dumpFile, () => {});
  });

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

  // function duty(bytes32 ilk) internal view returns (uint256 duty_) {
  //         (duty_,) = jug.ilks(ilk);
  //     }
  async function duty(ilk: string): Promise<SplitUintType<bigint>> {
    const { ilk: ilk_ } = await jug.call('ilks', {
      i: ilk,
    });
    return ilk_['duty'];
  }

  //     function rho(bytes32 ilk) internal view returns (uint256 rho_) {
  //         (, rho_) = jug.ilks(ilk);
  //     }
  async function rho(ilk: string): Promise<SplitUintType<bigint>> {
    const { ilk: ilk_ } = await jug.call('ilks', {
      i: ilk,
    });
    return ilk_['rho'];
  }

  //     function testConstructor() public {
  it('test constructor', async () => {
    //         assertEq(address(jug.vat()), address(vat));
    expect(l2Address((await jug.call('vat')).res)).to.equal(vat.address);
    //         assertEq(jug.wards(address(this)), 1);
    expect((await jug.call('wards', { user: _admin })).res).to.equal(1n);
  });

  //     function testAuth() public {
  it('test auth', async () => {
    //         checkAuth(address(jug), "Jug");
    await checkAuth(jug, 'Jug');
  });

  //     function testFile() public {
  //         checkFileUint(address(jug), "Jug", ["base"]);
  //         checkFileAddress(address(jug), "Jug", ["vow"]);
  //     }
  it('test file', async () => {});

  //     function testFileIlk() public {
  it('test file ilk', async () => {
    // jug.init(ILK);
    await invoke(admin, jug, 'init', { ilk: ILK });
    // vm.expectEmit(true, true, true, true);
    // emit File(ILK, "duty", 1);
    // jug.file(ILK, "duty", 1);
    await invoke(admin, jug, 'file_duty', { ilk: ILK, what: l2String('duty'), data: uint(1n) });
    //         assertEq(duty(ILK), 1);
    expect(await duty(ILK)).to.deep.equal(uint(1n));
    // Cannot set duty if rho not up to date
    // vm.warp(block.timestamp + 1);
    await starknet.devnet.increaseTime(1);
    await starknet.devnet.createBlock();
    let timestamp = await blockTimestamp();

    try {
      // jug.file(ILK, "duty", 1);
      await invoke(admin, jug, 'file_duty', { ilk: ILK, what: l2String('duty'), data: uint(1n) });
    } catch (err: any) {
      // vm.expectRevert("Jug/rho-not-updated");
      expect(err.message).to.contain('Jug/rho-not-updated');
    }
    // vm.warp(block.timestamp - 1);
    await starknet.devnet.setTime(timestamp - 1);
    await starknet.devnet.createBlock();
    // Invalid name
    try {
      // jug.file(ILK, "badWhat", 1);
      await invoke(admin, jug, 'file_duty', {
        ilk: ILK,
        what: l2String('badWhat'),
        data: uint(1n),
      });
    } catch (err: any) {
      // vm.expectRevert("Jug/file-unrecognized-param");
      expect(err.message).to.contain('Jug/rho-not-updated');
    }
    // Not authed
    try {
      // jug.deny(address(this));
      await invoke(admin, jug, 'deny', { usr: _admin });
      // jug.file(ILK, "duty", 1);
      await invoke(admin, jug, 'file_duty', {
        ilk: ILK,
        what: l2String('duty'),
        data: uint(1n),
      });
    } catch (err: any) {
      // vm.expectRevert("Jug/not-authorized");
      expect(err.message).to.contain('Jug/not-authorized');
    }
  });

  // function testInit() public {
  it('test init', async () => {
    // assertEq(rho(ILK), 0);
    // assertEq(duty(ILK), 0);
    expect(await rho(ILK)).to.be.equal(0n);
    expect(await duty(ILK)).to.deep.equal(uint(0n));
    // vm.expectEmit(true, true, true, true);
    // emit Init(ILK);
    // jug.init(ILK);
    await invoke(admin, jug, 'init', { ilk: ILK });
    // assertEq(rho(ILK), block.timestamp);
    // assertEq(duty(ILK), RAY);
    let timestamp = await blockTimestamp();
    expect(await rho(ILK)).to.be.equal(BigInt(timestamp));
    expect(await duty(ILK)).to.deep.equal(uint(RAY));
  });

  // function testDripUpdatesRho() public {
  it('test drip updates rho', async () => {
    // jug.init(ILK);
    await invoke(admin, jug, 'init', { ilk: ILK });
    // jug.file(ILK, "duty", 10 ** 27);
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(RAY),
    });
    // jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    // assertEq(rho(ILK), block.timestamp);
    let timestamp = await blockTimestamp();
    expect(await rho(ILK)).to.be.equal(BigInt(timestamp));
    // vm.warp(block.timestamp + 1);
    await starknet.devnet.increaseTime(1);
    await starknet.devnet.createBlock();
    // assertEq(rho(ILK), block.timestamp - 1);
    timestamp = await blockTimestamp();
    expect(await rho(ILK)).to.be.equal(BigInt(timestamp - 1));
    // jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    // assertEq(rho(ILK), block.timestamp);
    timestamp = await blockTimestamp();
    expect(await rho(ILK)).to.be.equal(BigInt(timestamp));
    // vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    // jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    // assertEq(rho(ILK), block.timestamp);
    timestamp = await blockTimestamp();
    expect(await rho(ILK)).to.be.equal(BigInt(timestamp));
  });

  // function testDripFile() public {
  it('test drip file', async () => {
    // jug.init(ILK);
    await invoke(admin, jug, 'init', { ilk: ILK });
    // jug.file(ILK, "duty", RAY);
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(RAY),
    });
    // jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    // jug.file(ILK, "duty", 1000000564701133626865910626);  // 5% / day
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1000000564701133626865910626n),
    });
  });

  // function testDrip0d() public {
  it('test drip0d', async () => {
    //     jug.init(ILK);
    await invoke(admin, jug, 'init', { ilk: ILK });
    //     jug.file(ILK, "duty", 1000000564701133626865910626);  // 5% / day
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1000000564701133626865910626n),
    });
    //     assertEq(vat.dai(TEST_ADDRESS), 0);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(uint(0n));
    //     jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    //     assertEq(vat.dai(TEST_ADDRESS), 0);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(uint(0n));
  });

  // function testDrip1d() public {
  it('test drip1d', async () => {
    // jug.init(ILK);
    // jug.file("vow", TEST_ADDRESS);
    // jug.file(ILK, "duty", 1000000564701133626865910626);  // 5% / day
    await invoke(admin, jug, 'init', { ilk: ILK });
    await invoke(admin, jug, 'file', {
      what: l2String('vow'),
      data: TEST_ADDRESS,
    });
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1000000564701133626865910626n),
    });
    // vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    // assertEq(vat.dai(TEST_ADDRESS), 0 ether);
    // jug.drip(ILK);
    // assertEq(vat.dai(TEST_ADDRESS), 5000000000000000000001603800000000000000000000);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(uint(0n));
    await invoke(admin, jug, 'drip', { ilk: ILK });
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(
      uint(5000000000000000000001603800000000000000000000n)
    );
  });

  // function testDrip2d() public {
  it('test drip2d', async () => {
    // jug.init(ILK);
    // jug.file("vow", TEST_ADDRESS);
    // jug.file(ILK, "duty", 1000000564701133626865910626);  // 5% / day
    await invoke(admin, jug, 'init', { ilk: ILK });
    await invoke(admin, jug, 'file', {
      what: l2String('vow'),
      data: TEST_ADDRESS,
    });
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1000000564701133626865910626n),
    });
    // vm.warp(block.timestamp + 2 days);
    await starknet.devnet.increaseTime(DAY * 2);
    await starknet.devnet.createBlock();
    // assertEq(vat.dai(TEST_ADDRESS), 0 ether);
    // jug.drip(ILK);
    // assertEq(vat.dai(TEST_ADDRESS), 10250000000000000000003367800000000000000000000);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(uint(0n));
    await invoke(admin, jug, 'drip', { ilk: ILK });
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(
      uint(10250000000000000000003367800000000000000000000n)
    );
  });

  // function testDrip3d() public {
  it('test drip3d', async () => {
    // jug.init(ILK);
    // jug.file("vow", TEST_ADDRESS);
    // jug.file(ILK, "duty", 1000000564701133626865910626);  // 5% / day
    await invoke(admin, jug, 'init', { ilk: ILK });
    await invoke(admin, jug, 'file', {
      what: l2String('vow'),
      data: TEST_ADDRESS,
    });
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1000000564701133626865910626n),
    });
    // vm.warp(block.timestamp + 3 days);
    await starknet.devnet.increaseTime(DAY * 3);
    await starknet.devnet.createBlock();
    // assertEq(vat.dai(TEST_ADDRESS), 0 ether);
    // jug.drip(ILK);
    // assertEq(vat.dai(TEST_ADDRESS), 15762500000000000000005304200000000000000000000);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(uint(0n));
    await invoke(admin, jug, 'drip', { ilk: ILK });
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(
      uint(15762500000000000000005304200000000000000000000n)
    );
  });

  // function testDripNegative3d() public {
  it('test drip negative 3d', async () => {
    // jug.init(ILK);
    // jug.file("vow", TEST_ADDRESS);
    // jug.file(ILK, "duty", 999999706969857929985428567);  // -2.5% / day
    await invoke(admin, jug, 'init', { ilk: ILK });
    await invoke(admin, jug, 'file', {
      what: l2String('vow'),
      data: TEST_ADDRESS,
    });
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(999999706969857929985428567n),
    });
    // vm.warp(block.timestamp + 3 days);
    await starknet.devnet.increaseTime(DAY * 3);
    await starknet.devnet.createBlock();
    // assertEq(vat.dai(address(this)), 100 * RAD);
    expect((await vat.call('dai', { u: _admin })).res).to.deep.equal(uint(100n * RAD));
    // vat.move(address(this), TEST_ADDRESS, 100 * RAD);
    invoke(admin, vat, 'move', {
      src: _admin,
      dst: TEST_ADDRESS,
      rad: uint(100n * RAD),
    });
    // assertEq(vat.dai(TEST_ADDRESS), 100 * RAD);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(uint(100n * RAD));
    // jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    // assertEq(vat.dai(TEST_ADDRESS), 92685937500000000000002288500000000000000000000);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(
      uint(92685937500000000000002288500000000000000000000n)
    );
  });

  // function testDripMulti() public {
  it('test drip multi', async () => {
    // jug.init(ILK);
    // jug.file("vow", TEST_ADDRESS);
    // jug.file(ILK, "duty", 1000000564701133626865910626);  // 5% / day
    await invoke(admin, jug, 'init', { ilk: ILK });
    await invoke(admin, jug, 'file', {
      what: l2String('vow'),
      data: TEST_ADDRESS,
    });
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1000000564701133626865910626n),
    });
    // vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    // jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    // assertEq(vat.dai(TEST_ADDRESS), 5000000000000000000001603800000000000000000000);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(
      uint(5000000000000000000001603800000000000000000000n)
    );
    // jug.file(ILK, "duty", 1000001103127689513476993127);  // 10% / day
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1000000564701133626865910626n),
    });
    // vm.warp(block.timestamp + 1 days);
    await starknet.devnet.increaseTime(DAY);
    await starknet.devnet.createBlock();
    // jug.drip(ILK);
    await invoke(admin, jug, 'drip', { ilk: ILK });
    // assertEq(vat.dai(TEST_ADDRESS), 15500000000000000000006151700000000000000000000);
    expect((await vat.call('dai', { u: TEST_ADDRESS })).res).to.deep.equal(
      uint(15500000000000000000006151700000000000000000000n)
    );
    // assertEq(vat.debt(), 115500000000000000000006151700000000000000000000);
    expect((await vat.call('debt')).debt).to.deep.equal(
      uint(115500000000000000000006151700000000000000000000n)
    );
    // assertEq(vat.rate(ILK) / 10 ** 9, 1.155 ether);
    let { ilk } = await vat.call('ilks', { i: ILK });
    let rate = new SplitUint(ilk.rate).toUint() / 10n ** 9n;
    expect(rate).to.equal(eth('1.155').toBigInt());
  });

  // function testDripBase() public {
  it('test drip base', async () => {
    // jug.init(ILK);
    // jug.file("vow", TEST_ADDRESS);
    // jug.file(ILK, "duty", 1050000000000000000000000000);  // 5% / second
    await invoke(admin, jug, 'init', { ilk: ILK });
    await invoke(admin, jug, 'file', {
      what: l2String('vow'),
      data: TEST_ADDRESS,
    });
    await invoke(admin, jug, 'file_duty', {
      ilk: ILK,
      what: l2String('duty'),
      data: uint(1050000000000000000000000000n),
    });
    // jug.file("base", uint256(50000000000000000000000000)); // 5% / second
    await invoke(admin, jug, 'file_base', {
      what: l2String('base'),
      data: uint(50000000000000000000000000n),
    });
    // vm.warp(block.timestamp + 1);
    // jug.drip(ILK);
    // assertEq(vat.dai(TEST_ADDRESS), 10 * RAD);
  });

  //     function testRpow() public {
  //         Rpow r = new Rpow(address(vat));
  //         uint result = r.pRpow(uint256(1000234891009084238901289093), uint256(3724), uint256(1e27));
  //         // python calc = 2.397991232255757e27 = 2397991232255757e12
  //         // expect 10 decimal precision
  //         assertEq(result / uint256(1e17), uint256(2397991232255757e12) / 1e17);
  //     }
});
