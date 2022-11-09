import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { HttpNetworkConfig } from 'hardhat/types';

import { asDec, eth, l2Eth, simpleDeployL2, SplitUint, toBytes32, l2String } from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = '9379074284324409537785911406195';

const ILK = l2String('SOME-ILK-A');

const TEST_ADDRESS = '9379074284324409537785911406195';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

const Line = l2String('Line');
const line = l2String('line');
const spot = l2String('spot');
const dust = l2String('dust');

const dumpFile = 'unittest-dump.dmp';

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('vat', async function () {
  this.timeout(900_000);
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let vat: any;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;
    vat = await simpleDeployL2(
      'vat',
      {
        ward: _admin,
      },
      hre
    );

    await starknet.devnet.dump(dumpFile);
    await sleep(5000);
  });

  async function checkAuth(base: any, contractName: string) {
    const { res: ward } = await base.call('wards', { user: _admin });

    // await GodMode.setWard(base.address, this, 1);

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await admin.invoke(base, 'rely', { usr: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(1n);

    await admin.invoke(base, 'deny', { usr: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await admin.invoke(base, 'deny', { usr: _admin });

    try {
      await admin.invoke(base, 'rely', { usr: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }
    try {
      await admin.invoke(base, 'deny', { usr: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }

    // await GodMode.setWard(base.address, this, ward);
  }

  async function checkFileUint(base: any, contractName: string, values: string[]) {
    const { res: ward } = await base.call('wards', { user: _admin });

    // Ensure we have admin access
    // await GodMode.setWard(base, admin.address, 1);

    // First check an invalid value
    try {
      await admin.invoke(base, 'file', {
        what: l2String('an invalid value'),
        data: {
          low: 1,
          high: 0,
        },
      });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/file-unrecognized-param`);
    }

    // Next check each value is valid and updates the target storage slot
    for (let i = 0; i < values.length; i++) {
      // Read original value
      const { [values[i]]: _origData } = await base.call(values[i]);
      const origData = new SplitUint(_origData);
      const newData = origData.add(1);

      // Update value
      // vm.expectEmit(true, false, false, true);
      // emit File(valueB32, newData);
      await admin.invoke(base, 'file', {
        what: l2String(values[i]),
        data: {
          low: newData.toDec()[0],
          high: newData.toDec()[1],
        },
      });

      // Confirm it was updated successfully
      const { [values[i]]: _data } = await base.call(values[i]);
      const data = new SplitUint(_data);
      expect(data).to.deep.equal(newData);

      // Reset value to original
      // vm.expectEmit(true, false, false, true);
      // emit File(valueB32, origData);
      await admin.invoke(base, 'file', {
        what: l2String(values[i]),
        data: {
          low: origData.toDec()[0],
          high: origData.toDec()[0],
        },
      });
    }

    // Finally check that file is authed
    await admin.invoke(base, 'deny', { usr: _admin });
    try {
      await admin.invoke(base, 'file', {
        what: l2String('some value'),
        data: {
          low: 1,
          high: 0,
        },
      });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }

    // Reset admin access to what it was
    // GodMode.setWard(base.address, this, ward);
  }

  beforeEach(async () => {
    await starknet.devnet.load(dumpFile);
  });

  async function setupCdpOps() {
    await admin.invoke(vat, 'init', {
      ilk: ILK,
    });
    await admin.invoke(vat, 'file', {
      what: Line,
      data: {
        low: l2Eth(1000n * RAD).toDec()[0],
        high: l2Eth(1000n * RAD).toDec()[1],
      },
    });
    await admin.invoke(vat, 'file_ilk', {
      ilk: ILK,
      what: spot,
      data: {
        low: l2Eth(RAY).toDec()[0],
        high: l2Eth(RAY).toDec()[1],
      },
    });
    await admin.invoke(vat, 'file_ilk', {
      ilk: ILK,
      what: line,
      data: {
        low: l2Eth(1000n * RAD).toDec()[0],
        high: l2Eth(1000n * RAD).toDec()[1],
      },
    });
    await admin.invoke(vat, 'file_ilk', {
      ilk: ILK,
      what: dust,
      data: {
        low: l2Eth(10n * RAD).toDec()[0],
        high: l2Eth(10n * RAD).toDec()[1],
      },
    });

    // Give some gems to the users
    await admin.invoke(vat, 'slip', {
      ilk: ILK,
      usr: _admin,
      wad: {
        low: l2Eth(100n * WAD).toDec()[0],
        high: l2Eth(100n * WAD).toDec()[1],
      },
    });
    await admin.invoke(vat, 'slip', {
      ilk: ILK,
      usr: user2.address,
      wad: {
        low: l2Eth(100n * WAD).toDec()[0],
        high: l2Eth(100n * WAD).toDec()[1],
      },
    });
  }

  it('test constructor', async () => {
    expect((await vat.call('live')).live).to.equal(1n);
    expect((await vat.call('wards', { user: _admin })).res).to.equal(1n);
  });

  it('test auth', async () => {
    await checkAuth(vat, 'Vat');
  });

  it('test file', async () => {
    await checkFileUint(vat, 'Vat', ['Line']);
  });

  it('test file ilk', async () => {
    // vm.expectEmit(true, true, true, true);
    // emit File(ILK, "spot", 1);
    await admin.invoke(vat, 'file_ilk', {
      ilk: ILK,
      what: spot,
      data: SplitUint.fromUint(1).res,
    });
    expect((await vat.call('ilks', { i: ILK })).ilk.spot).to.deep.equal(SplitUint.fromUint(1).res);
    await admin.invoke(vat, 'file_ilk', {
      ilk: ILK,
      what: line,
      data: SplitUint.fromUint(1).res,
    });
    expect((await vat.call('ilks', { i: ILK })).ilk.line).to.deep.equal(SplitUint.fromUint(1).res);
    await admin.invoke(vat, 'file_ilk', {
      ilk: ILK,
      what: dust,
      data: SplitUint.fromUint(1).res,
    });
    expect((await vat.call('ilks', { i: ILK })).ilk.dust).to.deep.equal(SplitUint.fromUint(1).res);

    // Invalid name
    try {
      await admin.invoke(vat, 'file_ilk', {
        ilk: ILK,
        what: l2String('badWhat'),
        data: SplitUint.fromUint(1).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('Vat/file-unrecognized-param');
    }

    // Not authed
    await admin.invoke(vat, 'deny', { usr: _admin });
    try {
      await admin.invoke(vat, 'file_ilk', {
        ilk: ILK,
        what: spot,
        data: SplitUint.fromUint(1).res,
      });
    } catch (err: any) {
      expect(err.message).to.contain('Vat/not-authorized');
    }
  });

  it('test auth modifier', async () => {
    await admin.invoke(vat, 'deny', { usr: _user1 });

    const funcs = [
      ['init', { ilk: ILK }],
      ['cage', {}],
      ['slip', { ilk: ILK, usr: 0, wad: { low: 0, high: 0 } }],
      [
        'grab',
        {
          i: ILK,
          u: 0,
          v: 0,
          w: 0,
          dink: { low: 0, high: 0 },
          dart: { low: 0, high: 0 },
        },
      ],
      ['suck', { u: 0, v: 0, rad: { low: 0, high: 0 } }],
      ['fold', { i: ILK, u: 0, rate: { low: 0, high: 0 } }],
    ];
    for (let i = 0; i < funcs.length; i++) {
      try {
        await user1.invoke(vat, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-authorized');
      }
    }
  });

  it('test live', async () => {
    await admin.invoke(vat, 'cage');

    const funcs = [
      ['rely', { usr: 0 }],
      ['deny', { usr: 0 }],
      ['file', { what: Line, data: { low: 0, high: 0 } }],
      ['file_ilk', { ilk: ILK, what: Line, data: { low: 0, high: 0 } }],
      [
        'frob',
        {
          i: ILK,
          u: 0,
          v: 0,
          w: 0,
          dink: { low: 0, high: 0 },
          dart: { low: 0, high: 0 },
        },
      ],
      ['fold', { i: ILK, u: 0, rate: { low: 0, high: 0 } }],
    ];
    for (let i = 0; i < funcs.length; i++) {
      try {
        await admin.invoke(vat, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-live');
      }
    }
  });

  it('test init', async () => {
    expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(SplitUint.fromUint(0).res);

    // vm.expectEmit(true, true, true, true);
    // emit Init(ILK);
    await admin.invoke(vat, 'init', { ilk: ILK });

    console.log(RAY);
    console.log(SplitUint.fromUint(RAY).res);
    expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(
      SplitUint.fromUint(RAY).res
    );
  });

  it("test init can't set twice", async () => {
    try {
      await admin.invoke(vat, 'init', { ilk: ILK });
    } catch (err: any) {
      expect(err.message).to.contain('Vat/ilk-already-init');
    }
  });

  it('test cage', async () => {
    expect((await vat.call('live')).live).to.equal(1n);

    // vm.expectEmit(true, true, true, true);
    // emit Cage();
    await admin.invoke(vat, 'cage');

    expect((await vat.call('live')).live).to.equal(0n);
  });

  it('test hope', async () => {
    expect(
      (
        await vat.call('can', {
          b: _admin,
          u: TEST_ADDRESS,
        })
      ).res
    ).to.equal(0n);

    // vm.expectEmit(true, true, true, true);
    // emit Hope(address(this), TEST_ADDRESS);
    await vat.call('hope', { user: TEST_ADDRESS });

    expect(
      (
        await vat.call('can', {
          b: _admin,
          u: TEST_ADDRESS,
        })
      ).res
    ).to.equal(0n);
  });

  it('test nope', async () => {
    await admin.invoke(vat, 'hope', { user: TEST_ADDRESS });

    expect(
      (
        await vat.call('can', {
          b: _admin,
          u: TEST_ADDRESS,
        })
      ).res
    ).to.equal(1n);

    // vm.expectEmit(true, true, true, true);
    // emit Nope(address(this), TEST_ADDRESS);
    await admin.invoke(vat, 'nope', { user: TEST_ADDRESS });

    expect(
      (
        await vat.call('can', {
          b: _admin,
          u: TEST_ADDRESS,
        })
      ).res
    ).to.equal(0n);
  });

  describe('slip', async function () {
    it('test slip positive', async () => {
      expect((await vat.call('gem', { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(
        SplitUint.fromUint(0).res
      );

      // vm.expectEmit(true, true, true, true);
      // emit Slip(ILK, TEST_ADDRESS, int256(100 * WAD));
      await admin.invoke(vat, 'slip', {
        ilk: ILK,
        usr: TEST_ADDRESS,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(
        SplitUint.fromUint(100n * WAD).res
      );
    });
    /*
    it("test slip negative", async () => {
      await admin.invoke(vat, "slip", {
        ilk: ILK,
        user: TEST_ADDRESS,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call("gem", { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(SplitUint.fromUint(100n * WAD).res);

      // vm.expectEmit(true, true, true, true);
      // emit Slip(ILK, TEST_ADDRESS, -int256(50 * WAD));

      await admin.invoke(vat, "slip", { i: ILK, u: TEST_ADDRESS, wad: SplitUint.fromUint(-50n * WAD).res });

      expect((await vat.call("gem", { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(SplitUint.fromUint(50n * WAD).res);
    });
    it("test slip negative underflow", async () => {
      expect((await vat.call("gem", { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(SplitUint.fromUint(0).res);

      await admin.invoke(vat, "slip", { ilk: ILK, user: TEST_ADDRESS, wad: SplitUint.fromUint(-50n * WAD).res });
    });
    */
  });
  describe('flux', async function () {
    it('test flux self other', async () => {
      await admin.invoke(vat, 'slip', {
        ilk: ILK,
        usr: _user1,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.equal(
        SplitUint.fromUint(100n * WAD).res
      );
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.equal(
        SplitUint.fromUint(0).res
      );

      // vm.expectEmit(true, true, true, true);
      // emit Flux(ILK, ausr1, ausr2, 100 * WAD);
      await user1.invoke(vat, 'flux', {
        ilk: ILK,
        src: _user1,
        dst: _user2,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.equal(
        SplitUint.fromUint(0).res
      );
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.equal(
        SplitUint.fromUint(100n * WAD).res
      );
    });
    it('test flux other self', async () => {
      await admin.invoke(vat, 'slip', {
        ilk: ILK,
        usr: _user1,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.equal(
        SplitUint.fromUint(100n * WAD).res
      );
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.equal(
        SplitUint.fromUint(0).res
      );

      await user1.invoke(vat, 'hope', { user: _user1 });
      await user2.invoke(vat, 'flux', {
        ilk: ILK,
        src: _user1,
        dst: _user2,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.equal(
        SplitUint.fromUint(0).res
      );
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.equal(
        SplitUint.fromUint(100n * WAD).res
      );
    });
    it('test flux other self no permission', async () => {
      await admin.invoke(vat, 'slip', {
        ilk: ILK,
        usr: _user1,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.equal(
        SplitUint.fromUint(100n * WAD).res
      );
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.equal(
        SplitUint.fromUint(0).res
      );

      try {
        await user2.invoke(vat, 'flux', {
          ilk: ILK,
          src: _user1,
          dst: _user2,
          wad: SplitUint.fromUint(100n * WAD).res,
        });
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-allowed');
      }
    });
    it('test flux self self', async () => {
      await admin.invoke(vat, 'slip', {
        ilk: ILK,
        usr: _user1,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.equal(
        SplitUint.fromUint(100n * WAD).res
      );

      await user1.invoke(vat, 'flux', {
        ilk: ILK,
        src: _user1,
        dst: _user1,
        wad: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.equal(
        SplitUint.fromUint(100n * WAD).res
      );
    });
    it('test flux underflow', async () => {
      try {
        await user1.invoke(vat, 'flux', {
          ilk: ILK,
          src: _user1,
          dst: _user2,
          wad: SplitUint.fromUint(100n * WAD).res,
        });
      } catch (err: any) {
        expect(err.message).to.contain('');
      }
    });
  });
  describe('move', async function () {
    it('test move self other', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      // assertEq(vat.dai(ausr1), 100 * RAD);
      // assertEq(vat.dai(ausr2), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Move(ausr1, ausr2, 100 * RAD);
      // usr1.move(ausr1, ausr2, 100 * RAD);
      // assertEq(vat.dai(ausr1), 0);
      // assertEq(vat.dai(ausr2), 100 * RAD);
    });
    it('test move other self', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      // assertEq(vat.dai(ausr1), 100 * RAD);
      // assertEq(vat.dai(ausr2), 0);
      // usr1.hope(ausr2);
      // usr2.move(ausr1, ausr2, 100 * RAD);
      // assertEq(vat.dai(ausr1), 0);
      // assertEq(vat.dai(ausr2), 100 * RAD);
    });
    it('test move other self no permission', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      // assertEq(vat.dai(ausr1), 100 * RAD);
      // assertEq(vat.dai(ausr2), 0);
      // vm.expectRevert("Vat/not-allowed");
      // usr2.move(ausr1, ausr2, 100 * RAD);
    });
    it('test move self self', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      // assertEq(vat.dai(ausr1), 100 * RAD);
      // usr1.move(ausr1, ausr1, 100 * RAD);
      // assertEq(vat.dai(ausr1), 100 * RAD);
    });
    it('test move underflow', async () => {
      // vm.expectRevert(stdError.arithmeticError);
      // usr1.move(ausr1, ausr2, 100 * RAD);
    });
  });

  describe('frob', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });

    it('test not init', async () => {
      // vm.expectRevert("Vat/ilk-not-init");
      // usr1.frob(ILK, ausr1, ausr1, ausr1, 0, 0);
    });
    it('test frob mint', async () => {
      // assertEq(usr1.dai(), 0);
      // assertEq(usr1.ink(ILK), 0);
      // assertEq(usr1.art(ILK), 0);
      // assertEq(usr1.gems(ILK), 100 * WAD);
      // assertEq(vat.Art(ILK), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.dai(), 100 * RAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.gems(ILK), 0);
      // assertEq(vat.Art(ILK), 100 * WAD);
    });
    it('test frob repay', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.dai(), 100 * RAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.gems(ILK), 0);
      // assertEq(vat.Art(ILK), 100 * WAD);
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr1, ausr1, -int256(50 * WAD), -int256(50 * WAD));
      // usr1.frob(ILK, ausr1, ausr1, ausr1, -int256(50 * WAD), -int256(50 * WAD));
      // assertEq(usr1.dai(), 50 * RAD);
      // assertEq(usr1.ink(ILK), 50 * WAD);
      // assertEq(usr1.art(ILK), 50 * WAD);
      // assertEq(usr1.gems(ILK), 50 * WAD);
      // assertEq(vat.Art(ILK), 50 * WAD);
    });
    it('test frob cannot exceed ilk ceiling', async () => {
      // vat.file(ILK, "line", 10 * RAD);
      // vm.expectRevert("Vat/ceiling-exceeded");
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
    });
    it('test frob cannot exceed global ceiling', async () => {
      // vat.file("Line", 10 * RAD);
      // vm.expectRevert("Vat/ceiling-exceeded");
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
    });
    it('test frob not safe', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.dai(), 100 * RAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.gems(ILK), 0);
      // // Cannot mint one more DAI it's undercollateralized
      // vm.expectRevert("Vat/not-safe");
      // usr1.frob(ILK, ausr1, ausr1, ausr1, 0, int256(1 * WAD));
      // // Cannot remove even one ink or it's undercollateralized
      // vm.expectRevert("Vat/not-safe");
      // usr1.frob(ILK, ausr1, ausr1, ausr1, -int256(1 * WAD), 0);
    });
    it('test frob not safe less risky', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(50 * WAD), int256(50 * WAD));
      // assertEq(usr1.dai(), 50 * RAD);
      // assertEq(usr1.ink(ILK), 50 * WAD);
      // assertEq(usr1.art(ILK), 50 * WAD);
      // assertEq(usr1.gems(ILK), 50 * WAD);
      // vat.file(ILK, "spot", RAY / 2);     // Vault is underwater
      // // Can repay debt even if it's undercollateralized
      // usr1.frob(ILK, ausr1, ausr1, ausr1, 0, -int256(1 * WAD));
      // assertEq(usr1.dai(), 49 * RAD);
      // assertEq(usr1.ink(ILK), 50 * WAD);
      // assertEq(usr1.art(ILK), 49 * WAD);
      // assertEq(usr1.gems(ILK), 50 * WAD);
      // // Can add gems even if it's undercollateralized
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(1 * WAD), 0);
      // assertEq(usr1.dai(), 49 * RAD);
      // assertEq(usr1.ink(ILK), 51 * WAD);
      // assertEq(usr1.art(ILK), 49 * WAD);
      // assertEq(usr1.gems(ILK), 49 * WAD);
    });
    it('test frob permissionless and collateral', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.dai(), 100 * RAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.gems(ILK), 0);
      // assertEq(usr2.gems(ILK), 100 * WAD);
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr2, TEST_ADDRESS, int256(100 * WAD), 0);
      // usr2.frob(ILK, ausr1, ausr2, TEST_ADDRESS, int256(100 * WAD), 0);
      // assertEq(usr1.dai(), 100 * RAD);
      // assertEq(usr1.ink(ILK), 200 * WAD);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.gems(ILK), 0);
      // assertEq(usr2.gems(ILK), 0);
    });
    it('test frob permissionless repay', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // vat.suck(TEST_ADDRESS, ausr2, 100 * RAD);
      // assertEq(usr1.dai(), 100 * RAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.gems(ILK), 0);
      // assertEq(usr2.dai(), 100 * RAD);
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, TEST_ADDRESS, ausr2, 0, -int256(100 * WAD));
      // usr2.frob(ILK, ausr1, TEST_ADDRESS, ausr2, 0, -int256(100 * WAD));
      // assertEq(usr1.dai(), 100 * RAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr1.art(ILK), 0);
      // assertEq(usr1.gems(ILK), 0);
      // assertEq(usr2.dai(), 0);
    });
    it('test frob dusty', async () => {
      // vm.expectRevert("Vat/dust");
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(9 * WAD), int256(9 * WAD));
    });
    it('test frob other', async () => {
      // // usr2 can completely manipulate usr1's vault with permission
      // usr1.hope(ausr2);
      // usr2.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr2.frob(ILK, ausr1, ausr1, ausr1, -int256(50 * WAD), -int256(50 * WAD));
    });
    it('test frob non one rate', async () => {
      // vat.fold(ILK, TEST_ADDRESS, int256(1 * RAY / 10));  // 10% interest collected
      // assertEq(usr1.dai(), 0);
      // assertEq(usr1.ink(ILK), 0);
      // assertEq(usr1.art(ILK), 0);
      // assertEq(usr1.gems(ILK), 100 * WAD);
      // assertEq(vat.Art(ILK), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(90 * WAD));
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(90 * WAD));
      // assertEq(usr1.dai(), 99 * RAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr1.art(ILK), 90 * WAD);
      // assertEq(usr1.gems(ILK), 0);
      // assertEq(vat.Art(ILK), 90 * WAD);
    });
  });

  describe('fork', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });

    it('test fork self other', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr2.hope(ausr1);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr2.art(ILK), 0);
      // assertEq(usr2.ink(ILK), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr1.fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.art(ILK), 0);
      // assertEq(usr1.ink(ILK), 0);
      // assertEq(usr2.art(ILK), 100 * WAD);
      // assertEq(usr2.ink(ILK), 100 * WAD);
    });
    it('test fork self other negative', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr2.frob(ILK, ausr2, ausr2, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr2.hope(ausr1);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr2.art(ILK), 100 * WAD);
      // assertEq(usr2.ink(ILK), 100 * WAD);
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, -int256(100 * WAD), -int256(100 * WAD));
      // usr1.fork(ILK, ausr1, ausr2, -int256(100 * WAD), -int256(100 * WAD));
      // assertEq(usr1.art(ILK), 200 * WAD);
      // assertEq(usr1.ink(ILK), 200 * WAD);
      // assertEq(usr2.art(ILK), 0);
      // assertEq(usr2.ink(ILK), 0);
    });
    it('test fork self other no permission', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // vm.expectRevert("Vat/not-allowed");
      // usr1.fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
    });
    it('test fork other self', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr1.hope(ausr2);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr2.art(ILK), 0);
      // assertEq(usr2.ink(ILK), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr2.fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.art(ILK), 0);
      // assertEq(usr1.ink(ILK), 0);
      // assertEq(usr2.art(ILK), 100 * WAD);
      // assertEq(usr2.ink(ILK), 100 * WAD);
    });
    it('test fork other self negative', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr2.frob(ILK, ausr2, ausr2, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr1.hope(ausr2);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr2.art(ILK), 100 * WAD);
      // assertEq(usr2.ink(ILK), 100 * WAD);
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, -int256(100 * WAD), -int256(100 * WAD));
      // usr2.fork(ILK, ausr1, ausr2, -int256(100 * WAD), -int256(100 * WAD));
      // assertEq(usr1.art(ILK), 200 * WAD);
      // assertEq(usr1.ink(ILK), 200 * WAD);
      // assertEq(usr2.art(ILK), 0);
      // assertEq(usr2.ink(ILK), 0);
    });
    it('test fork other self no permission', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // vm.expectRevert("Vat/not-allowed");
      // usr2.fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
    });
    it('test fork self self', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr2.art(ILK), 0);
      // assertEq(usr2.ink(ILK), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr1.fork(ILK, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr2.art(ILK), 0);
      // assertEq(usr2.ink(ILK), 0);
    });
    it('test fork not safe src', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr2.frob(ILK, ausr2, ausr2, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr2.hope(ausr1);
      // vat.file(ILK, "spot", RAY / 2);     // Vaults are underwater
      // vm.expectRevert("Vat/not-safe-src");
      // usr1.fork(ILK, ausr1, ausr2, int256(20 * WAD), int256(20 * WAD));
    });
    it('test fork not safe dst', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(50 * WAD));
      // usr2.frob(ILK, ausr2, ausr2, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr2.hope(ausr1);
      // vat.file(ILK, "spot", RAY / 2);     // usr2 vault is underwater
      // vm.expectRevert("Vat/not-safe-dst");
      // usr1.fork(ILK, ausr1, ausr2, int256(20 * WAD), int256(10 * WAD));
    });
    it('test fork dust src', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr2.frob(ILK, ausr2, ausr2, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr2.hope(ausr1);
      // vm.expectRevert("Vat/dust-src");
      // usr1.fork(ILK, ausr1, ausr2, int256(95 * WAD), int256(95 * WAD));
    });
    it('test fork dust dst', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // usr2.frob(ILK, ausr2, ausr2, ausr2, int256(100 * WAD), int256(100 * WAD));
      // usr2.hope(ausr1);
      // vm.expectRevert("Vat/dust-dst");
      // usr1.fork(ILK, ausr1, ausr2, -int256(95 * WAD), -int256(95 * WAD));
    });
  });

  describe('grab', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });

    it('test grab', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(vat.Art(ILK), 100 * WAD);
      // assertEq(usr2.gems(ILK), 100 * WAD);
      // assertEq(vat.sin(TEST_ADDRESS), 0);
      // assertEq(vat.vice(), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Grab(ILK, ausr1, ausr2, TEST_ADDRESS, -int256(100 * WAD), -int256(100 * WAD));
      // vat.grab(ILK, ausr1, ausr2, TEST_ADDRESS, -int256(100 * WAD), -int256(100 * WAD));
      // assertEq(usr1.art(ILK), 0);
      // assertEq(usr1.ink(ILK), 0);
      // assertEq(vat.Art(ILK), 0);
      // assertEq(usr2.gems(ILK), 200 * WAD);
      // assertEq(vat.sin(TEST_ADDRESS), 100 * RAD);
      // assertEq(vat.vice(), 100 * RAD);
    });
    it('test grab partial', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(vat.Art(ILK), 100 * WAD);
      // assertEq(usr2.gems(ILK), 100 * WAD);
      // assertEq(vat.sin(TEST_ADDRESS), 0);
      // assertEq(vat.vice(), 0);
      // vm.expectEmit(true, true, true, true);
      // emit Grab(ILK, ausr1, ausr2, TEST_ADDRESS, -int256(50 * WAD), -int256(50 * WAD));
      // vat.grab(ILK, ausr1, ausr2, TEST_ADDRESS, -int256(50 * WAD), -int256(50 * WAD));
      // assertEq(usr1.art(ILK), 50 * WAD);
      // assertEq(usr1.ink(ILK), 50 * WAD);
      // assertEq(vat.Art(ILK), 50 * WAD);
      // assertEq(usr2.gems(ILK), 150 * WAD);
      // assertEq(vat.sin(TEST_ADDRESS), 50 * RAD);
      // assertEq(vat.vice(), 50 * RAD);
    });
    it('test grab positive', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      // vat.suck(TEST_ADDRESS, TEST_ADDRESS, 100 * RAD);
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(vat.Art(ILK), 100 * WAD);
      // assertEq(usr2.gems(ILK), 100 * WAD);
      // assertEq(vat.sin(TEST_ADDRESS), 100 * RAD);
      // assertEq(vat.vice(), 100 * RAD);
      // vm.expectEmit(true, true, true, true);
      // emit Grab(ILK, ausr1, ausr2, TEST_ADDRESS, int256(100 * WAD), int256(100 * WAD));
      // vat.grab(ILK, ausr1, ausr2, TEST_ADDRESS, int256(100 * WAD), int256(100 * WAD));
      // assertEq(usr1.art(ILK), 200 * WAD);
      // assertEq(usr1.ink(ILK), 200 * WAD);
      // assertEq(vat.Art(ILK), 200 * WAD);
      // assertEq(usr2.gems(ILK), 0);
      // assertEq(vat.sin(TEST_ADDRESS), 0);
      // assertEq(vat.vice(), 0);
    });
  });

  it('test heal', async () => {
    // vat.suck(ausr1, ausr1, 100 * RAD);
    //
    // assertEq(usr1.sin(), 100 * RAD);
    // assertEq(usr1.dai(), 100 * RAD);
    // assertEq(vat.vice(), 100 * RAD);
    // assertEq(vat.debt(), 100 * RAD);
    // vm.expectEmit(true, true, true, true);
    // emit Heal(ausr1, 100 * RAD);
    // usr1.heal(100 * RAD);
    //
    // assertEq(usr1.sin(), 0);
    // assertEq(usr1.dai(), 0);
    // assertEq(vat.vice(), 0);
    // assertEq(vat.debt(), 0);
  });
  it('test suck', async () => {
    // assertEq(usr1.sin(), 0);
    // assertEq(usr2.dai(), 0);
    // assertEq(vat.vice(), 0);
    // assertEq(vat.debt(), 0);
    // vm.expectEmit(true, true, true, true);
    // emit Suck(ausr1, ausr2, 100 * RAD);
    // vat.suck(ausr1, ausr2, 100 * RAD);
    //
    // assertEq(usr1.sin(), 100 * RAD);
    // assertEq(usr2.dai(), 100 * RAD);
    // assertEq(vat.vice(), 100 * RAD);
    // assertEq(vat.debt(), 100 * RAD);
  });

  describe('fold', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });
    it('test fold', async () => {
      await user1.invoke(vat, 'frob', {
        i: ILK,
        u: _user1,
        v: _user1,
        w: _user1,
        dink: SplitUint.fromUint(100n * WAD).res,
        dart: SplitUint.fromUint(100n * WAD).res,
      });

      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(
        SplitUint.fromUint(100n * WAD)
      );
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(SplitUint.fromUint(RAY));
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai).to.deep.equal(SplitUint.fromUint(0));
      expect((await vat.call('debt')).debt).to.deep.equal(SplitUint.fromUint(100n * RAD));

      // vm.expectEmit(true, true, true, true);
      // emit Fold(ILK, TEST_ADDRESS, int256(1 * RAY / 10));
      await admin.invoke(vat, 'fold', {
        i: ILK,
        u: TEST_ADDRESS,
        rate: SplitUint.fromUint((1n * RAY) / 10n).res,
      });

      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(
        SplitUint.fromUint(100n * WAD)
      );
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(
        SplitUint.fromUint((11n * RAY) / 10n)
      );
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai).to.deep.equal(
        SplitUint.fromUint(10)
      );
      expect((await vat.call('debt')).debt).to.deep.equal(SplitUint.fromUint(110n * RAD));
    });
    it('test fold negative', async () => {
      await user1.invoke(vat, 'frob', {
        i: ILK,
        u: _user1,
        v: _user1,
        w: _user1,
        dink: SplitUint.fromUint(100n * WAD).res,
        dart: SplitUint.fromUint(100n * WAD).res,
      });
      await admin.invoke(vat, 'fold', {
        i: ILK,
        u: TEST_ADDRESS,
        rate: SplitUint.fromUint((1n * RAY) / 10n),
      });

      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(
        SplitUint.fromUint(100n * WAD)
      );
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(
        SplitUint.fromUint((11n * RAY) / 10n)
      );
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai).to.deep.equal(
        SplitUint.fromUint(10n * RAD)
      );
      expect((await vat.call('debt')).debt).to.deep.equal(SplitUint.fromUint(110n * RAD));

      // vm.expectEmit(true, true, true, true);
      // emit Fold(ILK, TEST_ADDRESS, -int256(1 * RAY / 20));
      await admin.invoke(vat, 'fold', {
        i: ILK,
        u: TEST_ADDRESS,
        rate: SplitUint.fromUint((-1n * RAY) / 20n),
      });

      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(
        SplitUint.fromUint(100n * WAD)
      );
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(
        SplitUint.fromUint((21n * RAY) / 20n)
      );
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai).to.deep.equal(
        SplitUint.fromUint(5n * RAD)
      );
      expect((await vat.call('debt')).debt).to.deep.equal(SplitUint.fromUint(105n * RAD));
    });
  });
});
