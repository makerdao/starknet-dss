import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { Account, HttpNetworkConfig } from 'hardhat/types';

import {
  asDec,
  eth,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  toBytes32,
  l2String,
  invoke,
  checkAuth,
  rad,
  ray,
  wad,
  uint,
  SplitUintType,
} from './utils';

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

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  async function checkFileUint(base: any, contractName: string, values: string[]) {
    const { res: ward } = await base.call('wards', { user: _admin });

    // Ensure we have admin access
    // await GodMode.setWard(base, admin.address, 1);

    // First check an invalid value
    try {
      await invoke(admin, base, 'file', {
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
      await invoke(admin, base, 'file', {
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
      await invoke(admin, base, 'file', {
        what: l2String(values[i]),
        data: {
          low: origData.toDec()[0],
          high: origData.toDec()[0],
        },
      });
    }

    // Finally check that file is authed
    await invoke(admin, base, 'deny', { user: _admin });
    try {
      await invoke(admin, base, 'file', {
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
    await starknet.devnet.load('unittest-dump.dmp');
  });

  async function setupCdpOps() {
    await invoke(admin, vat, 'init', {
      ilk: ILK,
    });
    await invoke(admin, vat, 'file', {
      what: Line,
      data: rad(1000n),
    });
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: spot,
      data: ray(1n),
    });
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: line,
      data: rad(1000n),
    });
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: dust,
      data: rad(10n),
    });

    // Give some gems to the users
    await invoke(admin, vat, 'slip', {
      ilk: ILK,
      user: _admin,
      wad: wad(100n),
    });
    await invoke(admin, vat, 'slip', {
      ilk: ILK,
      user: _user2,
      wad: wad(100n),
    });
    await invoke(admin, vat, 'slip', {
      ilk: ILK,
      user: _user1,
      wad: wad(100n),
    });
  }

  async function frob(
    user: Account,
    i: any,
    u: any,
    v: any,
    w: any,
    dink: SplitUintType<bigint>,
    dart: SplitUintType<bigint>
  ) {
    await invoke(user, vat, 'frob', { i, u, v, w, dink, dart });
  }

  async function fork(
    user: Account,
    ilk: any,
    src: any,
    dst: any,
    dink: SplitUintType<bigint>,
    dart: SplitUintType<bigint>
  ) {
    await invoke(user, vat, 'frob', { ilk, src, dst, dink, dart });
  }

  async function grab(
    // user: Account,
    i: any,
    u: any,
    v: any,
    w: any,
    dink: SplitUintType<bigint>,
    dart: SplitUintType<bigint>
  ) {
    await invoke(admin, vat, 'grab', { i, u, v, w, dink, dart });
  }

  async function suck(u: any, v: any, rad: SplitUintType<bigint>) {
    await invoke(admin, vat, 'suck', { u, v, rad });
  }

  async function fold(i: any, u: any, rate: SplitUintType<bigint>) {
    await invoke(admin, vat, 'fold', { i, u, rate });
  }

  async function hope(from: Account, to: string) {
    await invoke(from, vat, 'hope', { user: to });
  }

  async function heal(from: Account, rad: SplitUintType<bigint>) {
    await invoke(from, vat, 'heal', { rad });
  }

  it('test constructor', async () => {
    expect((await vat.call('live')).live).to.equal(1n);
    expect((await vat.call('wards', { user: _admin })).res).to.equal(1n);
  });

  it('test auth', async () => {
    await checkAuth(vat, 'Vat', admin);
  });

  it('test file', async () => {
    await checkFileUint(vat, 'Vat', ['Line']);
  });

  it('test file ilk', async () => {
    // vm.expectEmit(true, true, true, true);
    // emit File(ILK, "spot", 1);
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: spot,
      data: uint(1n),
    });
    expect((await vat.call('ilks', { i: ILK })).ilk.spot).to.deep.equal(uint(1n));
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: line,
      data: uint(1n),
    });
    expect((await vat.call('ilks', { i: ILK })).ilk.line).to.deep.equal(uint(1n));
    await invoke(admin, vat, 'file_ilk', {
      ilk: ILK,
      what: dust,
      data: uint(1n),
    });
    expect((await vat.call('ilks', { i: ILK })).ilk.dust).to.deep.equal(uint(1n));

    // Invalid name
    try {
      await invoke(admin, vat, 'file_ilk', {
        ilk: ILK,
        what: l2String('badWhat'),
        data: uint(1n),
      });
    } catch (err: any) {
      expect(err.message).to.contain('Vat/file-unrecognized-param');
    }

    // Not authed
    await invoke(admin, vat, 'deny', { user: _admin });
    try {
      await invoke(admin, vat, 'file_ilk', {
        ilk: ILK,
        what: spot,
        data: uint(1n),
      });
    } catch (err: any) {
      expect(err.message).to.contain('Vat/not-authorized');
    }
  });

  it('test auth modifier', async () => {
    await invoke(admin, vat, 'deny', { user: _user1 });

    const funcs: any[] = [
      ['init', { ilk: ILK }],
      ['cage', {}],
      ['slip', { ilk: ILK, user: 0, wad: uint(0n) }],
      [
        'grab',
        {
          i: ILK,
          u: 0,
          v: 0,
          w: 0,
          dink: uint(0n),
          dart: uint(0n),
        },
      ],
      ['suck', { u: 0, v: 0, rad: uint(0n) }],
      ['fold', { i: ILK, u: 0, rate: uint(0n) }],
    ];
    for (let i = 0; i < funcs.length; i++) {
      try {
        await invoke(user1, vat, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-authorized');
      }
    }
  });

  it('test live', async () => {
    await invoke(admin, vat, 'cage');

    const funcs: any[] = [
      ['rely', { user: 0 }],
      ['deny', { user: 0 }],
      ['file', { what: Line, data: uint(0n) }],
      ['file_ilk', { ilk: ILK, what: Line, data: uint(0n) }],
      [
        'frob',
        {
          i: ILK,
          u: 0,
          v: 0,
          w: 0,
          dink: uint(0n),
          dart: uint(0n),
        },
      ],
      ['fold', { i: ILK, u: 0, rate: uint(0n) }],
    ];
    for (let i = 0; i < funcs.length; i++) {
      try {
        await invoke(admin, vat, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-live');
      }
    }
  });

  it('test init', async () => {
    expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(uint(0n));

    // vm.expectEmit(true, true, true, true);
    // emit Init(ILK);
    await invoke(admin, vat, 'init', { ilk: ILK });

    // console.log(RAY);
    // console.log(SplitUint.fromUint(RAY).res);
    expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(ray(1n));
  });

  it("test init can't set twice", async () => {
    try {
      await invoke(admin, vat, 'init', { ilk: ILK });
    } catch (err: any) {
      expect(err.message).to.contain('Vat/ilk-already-init');
    }
  });

  it('test cage', async () => {
    expect((await vat.call('live')).live).to.equal(1n);

    // vm.expectEmit(true, true, true, true);
    // emit Cage();
    await invoke(admin, vat, 'cage');

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
    await hope(admin, TEST_ADDRESS);

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
    await invoke(admin, vat, 'nope', { user: TEST_ADDRESS });

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
      expect((await vat.call('gem', { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(uint(0n));

      // vm.expectEmit(true, true, true, true);
      // emit Slip(ILK, TEST_ADDRESS, int256(100 * WAD));
      await invoke(admin, vat, 'slip', {
        ilk: ILK,
        user: TEST_ADDRESS,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(wad(100n));
    });
    /*
    it("test slip negative", async () => {
      await invoke(admin, vat, "slip", {
        ilk: ILK,
        user: TEST_ADDRESS,
        wad: wad(100n),
      });

      expect((await vat.call("gem", { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(wad(100n));

      // vm.expectEmit(true, true, true, true);
      // emit Slip(ILK, TEST_ADDRESS, -int256(50 * WAD));

      await invoke(admin, vat, "slip", { i: ILK, u: TEST_ADDRESS, wad: SplitUint.fromUint(-50n * WAD).res });

      expect((await vat.call("gem", { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(SplitUint.fromUint(50n * WAD).res);
    });
    it("test slip negative underflow", async () => {
      expect((await vat.call("gem", { i: ILK, u: TEST_ADDRESS })).gem).to.deep.equal(uint(0n));

      await invoke(admin, vat, "slip", { ilk: ILK, user: TEST_ADDRESS, wad: SplitUint.fromUint(-50n * WAD).res });
    });
    */
  });
  describe('flux', async function () {
    it('test flux self other', async () => {
      await invoke(admin, vat, 'slip', {
        ilk: ILK,
        user: _user1,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(uint(0n));

      // vm.expectEmit(true, true, true, true);
      // emit Flux(ILK, ausr1, ausr2, 100 * WAD);
      await invoke(user1, vat, 'flux', {
        ilk: ILK,
        src: _user1,
        dst: _user2,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(uint(0n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(100n));
    });
    it('test flux other self', async () => {
      await invoke(admin, vat, 'slip', {
        ilk: ILK,
        user: _user1,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(uint(0n));

      await hope(user1, _user1);
      await invoke(user2, vat, 'flux', {
        ilk: ILK,
        src: _user1,
        dst: _user2,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(uint(0n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(100n));
    });
    it('test flux other self no permission', async () => {
      await invoke(admin, vat, 'slip', {
        ilk: ILK,
        user: _user1,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(uint(0n));

      try {
        await invoke(user2, vat, 'flux', {
          ilk: ILK,
          src: _user1,
          dst: _user2,
          wad: wad(100n),
        });
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-allowed');
      }
    });
    it('test flux self self', async () => {
      await invoke(admin, vat, 'slip', {
        ilk: ILK,
        user: _user1,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(100n));

      await invoke(user1, vat, 'flux', {
        ilk: ILK,
        src: _user1,
        dst: _user1,
        wad: wad(100n),
      });

      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(100n));
    });
    it('test flux underflow', async () => {
      try {
        await invoke(user1, vat, 'flux', {
          ilk: ILK,
          src: _user1,
          dst: _user2,
          wad: wad(100n),
        });
      } catch (err: any) {
        expect(err.message).to.contain('');
      }
    });
  });
  describe('move', async function () {
    it('test move self other', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      await suck(TEST_ADDRESS, _user1, rad(100n));
      // assertEq(vat.dai(ausr1), 100 * RAD);
      // assertEq(vat.dai(ausr2), 0);
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(uint(0n));
      // vm.expectEmit(true, true, true, true);
      // emit Move(ausr1, ausr2, 100 * RAD);
      // usr1.move(ausr1, ausr2, 100 * RAD);
      invoke(user1, vat, 'move', { src: _user1, dst: _user2, rad: rad(100n) });
      // assertEq(vat.dai(ausr1), 0);
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(0n));
      // assertEq(vat.dai(ausr2), 100 * RAD);
      expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(rad(100n));
    });
    it('test move other self', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      await suck(TEST_ADDRESS, _user1, rad(100n));
      // assertEq(vat.dai(ausr1), 100 * RAD);
      // assertEq(vat.dai(ausr2), 0);
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(uint(0n));
      // usr1.hope(ausr2);
      await hope(user1, _user2);
      // usr2.move(ausr1, ausr2, 100 * RAD);
      await invoke(user2, vat, 'move', { src: _user1, dst: _user2, rad: rad(100n) });
      // assertEq(vat.dai(ausr1), 0);
      // assertEq(vat.dai(ausr2), 100 * RAD);
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(0n));
      expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(rad(100n));
    });
    it('test move other self no permission', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      await suck(TEST_ADDRESS, _user1, rad(100n));
      // assertEq(vat.dai(ausr1), 100 * RAD);
      // assertEq(vat.dai(ausr2), 0);
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(uint(0n));
      // vm.expectRevert("Vat/not-allowed");
      // usr2.move(ausr1, ausr2, 100 * RAD);
      try {
        await invoke(user2, vat, 'move', { src: _user1, dst: _user2, rad: rad(100n) });
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-allowed');
      }
    });
    it('test move self self', async () => {
      // vat.suck(TEST_ADDRESS, ausr1, 100 * RAD);
      await suck(TEST_ADDRESS, _user1, rad(100n));
      // assertEq(vat.dai(ausr1), 100 * RAD);
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      // usr1.move(ausr1, ausr1, 100 * RAD);
      await invoke(user1, vat, 'move', { src: _user1, dst: _user1, rad: rad(100n) });
      // assertEq(vat.dai(ausr1), 100 * RAD);
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
    });
    it('test move underflow', async () => {
      // vm.expectRevert(stdError.arithmeticError);
      // usr1.move(ausr1, ausr2, 100 * RAD);
      try {
        await invoke(user1, vat, 'move', { src: _user1, dst: _user2, rad: rad(100n) });
      } catch (err: any) {}
    });
  });

  describe('frob', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });

    it('test not init', async () => {
      try {
        await frob(user1, ILK, _user1, _user1, _user1, uint(0n), uint(0n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/ilk-not-init');
      }
    });
    it('test frob mint', async () => {
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(uint(0n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(uint(0n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(uint(0n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(uint(0n));
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      await frob(user1, ILK, _user1, _user1, _user1, uint(100n), uint(100n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
    });
    it('test frob repay', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, uint(100n), uint(100n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr1, ausr1, -int256(50 * WAD), -int256(50 * WAD));
      await frob(user1, ILK, _user1, _user1, _user1, wad(-50n), wad(-50n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(50n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(50n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(50n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(50n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(50n));
    });
    it('test frob cannot exceed ilk ceiling', async () => {
      // vat.file(ILK, "line", 10 * RAD);
      await invoke(admin, vat, 'file', {
        what: line,
        data: rad(10n),
      });

      try {
        await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/ceiling-exceeded');
      }
    });
    it('test frob cannot exceed global ceiling', async () => {
      // vat.file("Line", 10 * RAD);
      await invoke(admin, vat, 'file', {
        what: Line,
        data: rad(10n),
      });
      // vm.expectRevert("Vat/ceiling-exceeded");
      try {
        await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/ceiling-exceeded');
      }
    });
    it('test frob not safe', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      // // Cannot mint one more DAI it's undercollateralized
      try {
        await frob(user1, ILK, _user1, _user1, _user1, wad(0n), wad(1n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-safe');
      }
      // // Cannot remove even one ink or it's undercollateralized
      try {
        await frob(user1, ILK, _user1, _user1, _user1, wad(-1n), wad(0n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-safe');
      }
    });
    it('test frob not safe less risky', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(50n), wad(50n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(50n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(50n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(50n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(50n));
      // vat.file(ILK, "spot", RAY / 2);     // Vault is underwater
      await invoke(admin, vat, 'file', {
        what: spot,
        data: uint(RAY / 2n),
      });
      // // Can repay debt even if it's undercollateralized
      await frob(user1, ILK, _user1, _user1, _user1, wad(0n), wad(-1n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(49n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(50n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(49n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(50n));
      // // Can add gems even if it's undercollateralized
      await frob(user1, ILK, _user1, _user1, _user1, wad(1n), wad(0n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(49n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(51n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(49n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(49n));
    });
    it('test frob permissionless and collateral', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(100n));
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr2, TEST_ADDRESS, int256(100 * WAD), 0);
      await frob(user2, ILK, _user1, _user2, TEST_ADDRESS, wad(100n), wad(0n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(0n));
    });
    it('test frob permissionless repay', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await suck(TEST_ADDRESS, _user2, rad(100n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(rad(100n));
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, TEST_ADDRESS, ausr2, 0, -int256(100 * WAD));
      await frob(user2, ILK, _user1, TEST_ADDRESS, _user2, uint(0n), wad(-100n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(rad(0n));
    });
    it('test frob dusty', async () => {
      try {
        await frob(user1, ILK, _user1, _user1, _user1, wad(9n), wad(9n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/dust');
      }
    });
    it('test frob other', async () => {
      // // usr2 can completely manipulate usr1's vault with permission
      await hope(user1, _user2);
      await frob(user2, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await frob(user2, ILK, _user1, _user1, _user1, wad(-50n), wad(-50n));
    });
    it('test frob non one rate', async () => {
      await fold(ILK, TEST_ADDRESS, SplitUint.fromUint((1n * RAY) / 10n).res); // 10% interest collected
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(0n));
      // vm.expectEmit(true, true, true, true);
      // emit Frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(90 * WAD));
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(90n));
      expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(99n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(90n));
      expect((await vat.call('gem', { i: ILK, u: _user1 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(90n));
    });
  });

  describe('fork', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });

    it('test fork self other', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await hope(user2, _user1);
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
      await fork(user1, ILK, _user1, _user2, wad(100n), wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));
    });
    it('test fork self other negative', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await frob(user2, ILK, _user2, _user2, _user2, wad(100n), wad(100n));
      await hope(user2, _user1);
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, -int256(100 * WAD), -int256(100 * WAD));
      await fork(user1, ILK, _user1, _user2, wad(-100n), wad(-100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
    });
    it('test fork self other no permission', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));

      // vm.expectRevert("Vat/not-allowed");
      // usr1.fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
      try {
        await fork(user1, ILK, _user1, _user2, wad(100n), wad(100n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-allowed');
      }
    });
    it('test fork other self', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await hope(user2, _user1);
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));

      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, int256(100 * WAD), int256(100 * WAD));
      await fork(user2, ILK, _user1, _user2, wad(100n), wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));
    });
    it('test fork other self negative', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));

      // usr2.frob(ILK, ausr2, ausr2, ausr2, int256(100 * WAD), int256(100 * WAD));
      await frob(user2, ILK, _user2, _user2, _user2, wad(100n), wad(100n));

      // usr1.hope(ausr2);
      await hope(user2, _user1);

      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(usr2.art(ILK), 100 * WAD);
      // assertEq(usr2.ink(ILK), 100 * WAD);
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(100n));

      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr2, -int256(100 * WAD), -int256(100 * WAD));
      // usr2.fork(ILK, ausr1, ausr2, -int256(100 * WAD), -int256(100 * WAD));
      await fork(user2, ILK, _user1, _user2, wad(-100n), wad(-100n));
      // assertEq(usr1.art(ILK), 200 * WAD);
      // assertEq(usr1.ink(ILK), 200 * WAD);
      // assertEq(usr2.art(ILK), 0);
      // assertEq(usr2.ink(ILK), 0);
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
    });
    it('test fork other self no permission', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));

      // vm.expectRevert("Vat/not-allowed");
      try {
        await fork(user2, ILK, _user1, _user2, wad(100n), wad(100n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-allowed');
      }
    });
    it('test fork self self', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      // vm.expectEmit(true, true, true, true);
      // emit Fork(ILK, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      await fork(user1, ILK, _user1, _user1, wad(100n), wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user2 })).res).to.deep.equal(wad(0n));
    });
    it('test fork not safe src', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await frob(user2, ILK, _user2, _user2, _user2, wad(100n), wad(100n));
      await hope(user2, _user1);
      // Vaults are underwater
      await invoke(admin, vat, 'file', {
        what: spot,
        data: SplitUint.fromUint(RAY / 2n).res,
      });
      try {
        await fork(user1, ILK, _user1, _user2, wad(20n), wad(20n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-safe-src');
      }
    });
    it('test fork not safe dst', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(50n));
      await frob(user2, ILK, _user2, _user2, _user2, wad(100n), wad(100n));
      await hope(user2, _user1);
      // usr2 vault is underwater
      await invoke(admin, vat, 'file', {
        what: spot,
        data: SplitUint.fromUint(RAY / 2n).res,
      });
      try {
        await fork(user1, ILK, _user1, _user2, wad(20n), wad(10n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/not-safe-dst');
      }
    });
    it('test fork dust src', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await frob(user2, ILK, _user2, _user2, _user2, wad(100n), wad(100n));
      await hope(user2, _user1);
      try {
        await fork(user1, ILK, _user1, _user2, wad(95n), wad(95n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/dust-src');
      }
    });
    it('test fork dust dst', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      await frob(user2, ILK, _user2, _user2, _user2, wad(100n), wad(100n));
      await hope(user2, _user1);
      try {
        await fork(user1, ILK, _user1, _user2, wad(-95n), wad(-95n));
      } catch (err: any) {
        expect(err.message).to.contain('Vat/dust-dst');
      }
    });
  });

  describe('grab', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });

    it('test grab', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(rad(0n));
      expect((await vat.call('vice')).vice).to.deep.equal(rad(0n));
      // vm.expectEmit(true, true, true, true);
      // emit Grab(ILK, ausr1, ausr2, TEST_ADDRESS, -int256(100 * WAD), -int256(100 * WAD));
      await grab(ILK, _user1, _user2, TEST_ADDRESS, wad(-100n), wad(-100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(0n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(0n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(200n));
      expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(rad(100n));
      expect((await vat.call('vice')).vice).to.deep.equal(rad(100n));
    });
    it('test grab partial', async () => {
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(rad(0n));
      expect((await vat.call('vice')).vice).to.deep.equal(rad(0n));
      // vm.expectEmit(true, true, true, true);
      // emit Grab(ILK, ausr1, ausr2, TEST_ADDRESS, -int256(50 * WAD), -int256(50 * WAD));
      await grab(ILK, _user1, _user2, TEST_ADDRESS, wad(-100n), wad(-100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(50n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(50n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(50n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(150n));
      expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(rad(50n));
      expect((await vat.call('vice')).vice).to.deep.equal(rad(50n));
    });
    it('test grab positive', async () => {
      // usr1.frob(ILK, ausr1, ausr1, ausr1, int256(100 * WAD), int256(100 * WAD));
      await frob(user1, ILK, _user1, _user1, _user1, wad(100n), wad(100n));

      // vat.suck(TEST_ADDRESS, TEST_ADDRESS, 100 * RAD);
      await suck(TEST_ADDRESS, TEST_ADDRESS, rad(100n));
      // assertEq(usr1.art(ILK), 100 * WAD);
      // assertEq(usr1.ink(ILK), 100 * WAD);
      // assertEq(vat.Art(ILK), 100 * WAD);
      // assertEq(usr2.gems(ILK), 100 * WAD);
      // assertEq(vat.sin(TEST_ADDRESS), 100 * RAD);
      // assertEq(vat.vice(), 100 * RAD);
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(100n));
      expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(rad(100n));
      expect((await vat.call('vice')).vice).to.deep.equal(rad(100n));
      // vm.expectEmit(true, true, true, true);
      // emit Grab(ILK, ausr1, ausr2, TEST_ADDRESS, int256(100 * WAD), int256(100 * WAD));
      await grab(ILK, _user1, _user2, TEST_ADDRESS, wad(100n), wad(100n));
      expect((await vat.call('art', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('ink', { i: ILK, u: _user1 })).res).to.deep.equal(wad(200n));
      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(200n));
      expect((await vat.call('gem', { i: ILK, u: _user2 })).gem).to.deep.equal(wad(0n));
      expect((await vat.call('sin', { u: TEST_ADDRESS })).sin).to.deep.equal(rad(0n));
      expect((await vat.call('vice')).vice).to.deep.equal(rad(0n));
    });
  });

  it('test heal', async () => {
    await suck(_user1, _user1, rad(100n));
    expect((await vat.call('sin', { u: _user1 })).sin).to.deep.equal(rad(100n));
    expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(100n));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(100n));
    expect((await vat.call('debt')).debt).to.deep.equal(rad(100n));
    // vm.expectEmit(true, true, true, true);
    // emit Heal(ausr1, 100 * RAD);
    await heal(user1, rad(100n));
    expect((await vat.call('sin', { u: _user1 })).sin).to.deep.equal(rad(0n));
    expect((await vat.call('dai', { u: _user1 })).dai).to.deep.equal(rad(0n));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(0n));
    expect((await vat.call('debt')).debt).to.deep.equal(rad(0n));
  });
  it('test suck', async () => {
    expect((await vat.call('sin', { u: _user1 })).sin).to.deep.equal(rad(0n));
    expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(rad(0n));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(0n));
    expect((await vat.call('debt')).debt).to.deep.equal(rad(0n));
    // vm.expectEmit(true, true, true, true);
    // emit Suck(ausr1, ausr2, 100 * RAD);
    await suck(_user1, _user2, rad(100n));
    expect((await vat.call('sin', { u: _user1 })).sin).to.deep.equal(rad(100n));
    expect((await vat.call('dai', { u: _user2 })).dai).to.deep.equal(rad(100n));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(100n));
    expect((await vat.call('debt')).debt).to.deep.equal(rad(100n));
  });

  describe('fold', async function () {
    beforeEach(async () => {
      await setupCdpOps();
    });
    it('test fold', async () => {
      await invoke(user1, vat, 'frob', {
        i: ILK,
        u: _user1,
        v: _user1,
        w: _user1,
        dink: wad(100n),
        dart: wad(100n),
      });

      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(ray(1n));
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai).to.deep.equal(uint(0n));
      expect((await vat.call('debt')).debt).to.deep.equal(rad(100n));

      // vm.expectEmit(true, true, true, true);
      // emit Fold(ILK, TEST_ADDRESS, int256(1 * RAY / 10));
      await fold(ILK, TEST_ADDRESS, SplitUint.fromUint((1n * RAY) / 10n).res);

      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(
        SplitUint.fromUint((11n * RAY) / 10n)
      );
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai).to.deep.equal(uint(10n));
      expect((await vat.call('debt')).debt).to.deep.equal(rad(110n));
    });
    it('test fold negative', async () => {
      await invoke(user1, vat, 'frob', {
        i: ILK,
        u: _user1,
        v: _user1,
        w: _user1,
        dink: wad(100n),
        dart: wad(100n),
      });
      await fold(ILK, TEST_ADDRESS, SplitUint.fromUint((1n * RAY) / 10n).res);

      expect((await vat.call('ilks', { i: ILK })).ilk.Art.res).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(
        SplitUint.fromUint((11n * RAY) / 10n)
      );
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai.res).to.deep.equal(rad(10n));
      expect((await vat.call('debt')).debt.res).to.deep.equal(rad(110n));

      // vm.expectEmit(true, true, true, true);
      // emit Fold(ILK, TEST_ADDRESS, -int256(1 * RAY / 20));
      await fold(ILK, TEST_ADDRESS, SplitUint.fromUint((-1n * RAY) / 20n).res);

      expect((await vat.call('ilks', { i: ILK })).ilk.Art).to.deep.equal(wad(100n));
      expect((await vat.call('ilks', { i: ILK })).ilk.rate).to.deep.equal(
        SplitUint.fromUint((21n * RAY) / 20n)
      );
      expect((await vat.call('dai', { u: TEST_ADDRESS })).dai).to.deep.equal(rad(5n));
      expect((await vat.call('debt')).debt).to.deep.equal(rad(105n));
    });
  });
});
