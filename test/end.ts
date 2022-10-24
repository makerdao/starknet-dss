import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { starknet } from 'hardhat';
import { Account, StarknetContract } from 'hardhat/types';
import { BigNumberish } from 'starknet/utils/number';

import {
  eth,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  l2String,
  l2Address,
  SplitUintType,
  uint,
  invoke,
  ray,
  wad,
  rad,
} from './utils';

const ILK = l2String('SOME-ILK-A');

const MAX = 2n ** 256n - 1n;

const MLN = 10 ** 6;

const RAY = 10n ** 27n;

const TEST_ADDRESS = '9379074284324409537785911406195';

const dumpFile = 'unittest-dump.dmp';

interface Ilk {
  pip: StarknetContract;
  gem: StarknetContract;
  gemA: StarknetContract;
}

const ILKS: Map<string, Ilk> = new Map();

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('end', async function () {
  this.timeout(900_000);
  let admin: Account;
  let _admin: string;
  let user1: Account;
  let _user1: string;
  let user2: Account;
  let _user2: string;
  let end: StarknetContract;
  let vat: StarknetContract;
  let vow: StarknetContract;
  let claimToken: StarknetContract;
  let pot: StarknetContract;
  let spot: StarknetContract;
  let cure: StarknetContract;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;
    // vat = new Vat();

    vat = await simpleDeployL2(
      'vat',
      {
        ward: _admin,
      },
      hre
    );
    // claimToken = new MockToken('CLAIM');
    claimToken = await simpleDeployL2('mock_token', { ward: _admin }, hre);
    // vow = new MockVow(vat);
    vow = await simpleDeployL2(
      'mock_vow',
      {
        vat_: vat.address,
      },
      hre
    );
    // pot = new Pot(address(vat));
    pot = await simpleDeployL2('mock_pot', { ward: _admin, vat: vat.address }, hre);
    // vat.rely(address(pot));
    await invoke(admin, vat, 'rely', { user: pot.address });
    // pot.file("vow", address(vow));
    await invoke(admin, pot, 'file', { what: l2String('vow'), data: vow.address });
    // spot = new Spotter(address(vat));
    spot = await simpleDeployL2('mock_spot', { ward: _admin, vat: vat.address }, hre);
    // vat.file("Line",         rad(1_000_000 ether));
    await invoke(admin, vat, 'file', {
      what: l2String('Line'),
      data: rad(eth('1000000').toBigInt()),
    });
    // vat.rely(address(spot));
    await invoke(admin, vat, 'rely', { user: spot.address });
    // cure = new Cure();
    cure = await simpleDeployL2(
      'cure',
      {
        ward: _admin,
      },
      hre
    );
    // end = new End(address(vat));
    end = await simpleDeployL2(
      'end',
      {
        ward: _admin,
      },
      hre
    );

    // end.file("vow", address(vow));
    await invoke(admin, end, 'file', {
      what: l2String('vow'),
      data: vow.address,
    });
    // end.file("pot", address(pot));
    await invoke(admin, end, 'file', {
      what: l2String('pot'),
      data: pot.address,
    });
    // end.file("spot", address(spot));
    await invoke(admin, end, 'file', {
      what: l2String('spot'),
      data: spot.address,
    });
    // end.file("cure", address(cure));
    await invoke(admin, end, 'file', {
      what: l2String('cure'),
      data: cure.address,
    });
    // end.file("claim", address(claimToken));
    await invoke(admin, end, 'file', {
      what: l2String('claim'),
      data: claimToken.address,
    });
    // end.file("wait", 1 hours);
    await invoke(admin, end, 'file_wait', {
      what: l2String('wait'),
      data: 3600n,
    });
    // vat.rely(address(end));
    await invoke(admin, vat, 'rely', { user: end.address });
    // spot.rely(address(end));
    await invoke(admin, spot, 'rely', { user: end.address });
    // pot.rely(address(end));
    await invoke(admin, pot, 'rely', { user: end.address });
    // cure.rely(address(end));
    await invoke(admin, cure, 'rely', { user: end.address });

    await starknet.devnet.dump(dumpFile);
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load(dumpFile);
  });

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

  async function checkAuth(base: any, contractName: string) {
    const { res: ward } = await base.call('wards', { user: _admin });

    // await GodMode.setWard(base.address, this, 1);

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await admin.invoke(base, 'rely', { user: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(1n);

    await admin.invoke(base, 'deny', { user: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await admin.invoke(base, 'deny', { user: _admin });

    try {
      await admin.invoke(base, 'rely', { user: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }
    try {
      await admin.invoke(base, 'deny', { user: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }

    // await GodMode.setWard(base.address, this, ward);
  }

  //   function dai(address urn) internal view returns (uint) {
  //       return vat.dai(urn) / RAY;
  //   }
  async function dai(urn: string): Promise<SplitUintType<bigint>> {
    const { res } = await vat.call('dai', { urn });
    const _res: SplitUint = new SplitUint(res);
    return uint(_res.toUint() / RAY);
  }
  //   function gem(bytes32 ilk, address urn) internal view returns (uint) {
  //       return vat.gem(ilk, urn);
  //   }
  async function gem(ilk: string, urn: string): Promise<SplitUintType<bigint>> {
    const { gem } = await vat.call('gem', { i: l2String(ilk), u: urn });
    return gem;
  }
  //   function ink(bytes32 ilk, address urn) internal view returns (uint) {
  //       (uint256 ink_, uint256 art_) = vat.urns(ilk, urn); art_;
  //       return ink_;
  //   }
  async function ink(ilk: string, urn: string) {
    const { urn: _urn } = await vat.call('urns', {
      i: l2String(ilk),
      u: urn,
    });
    return _urn['ink'];
  }
  //   function art(bytes32 ilk, address urn) internal view returns (uint) {
  //       (uint256 ink_, uint256 art_) = vat.urns(ilk, urn); ink_;
  //       return art_;
  //   }
  async function art(ilk: string, urn: string) {
    const { urn: _urn } = await vat.call('urns', {
      i: l2String(ilk),
      u: urn,
    });
    return _urn['art'];
  }
  //   function Art(bytes32 ilk) internal view returns (uint) {
  //       (uint256 Art_, uint256 rate_, uint256 spot_, uint256 line_, uint256 dust_) = vat.ilks(ilk);
  //       rate_; spot_; line_; dust_;
  //       return Art_;
  //   }
  async function Art(ilk: string) {
    const { ilk: _ilk } = await vat.call('ilks', { i: ILK });
    return _ilk['Art'];
  }
  //   function balanceOf(bytes32 ilk, address usr) internal view returns (uint) {
  //       return ilks[ilk].gem.balanceOf(usr);
  //   }
  async function balanceOf(ilk: string, usr: string): Promise<SplitUintType<bigint>> {
    const _ilk = ILKS.get(ilk);
    if (!_ilk) throw Error(`${ilk} does not exist in global mapping.`);
    const { res: _balance } = await _ilk.gem.call('balanceOf', { user: usr });
    return _balance;
  }

  //   function try_pot_file(bytes32 what, uint256 data) public returns(bool ok) {
  //       string memory sig = "file(bytes32, uint)";
  //       (ok,) = address(pot).call(abi.encodeWithSignature(sig, what, data));
  //   }
  async function try_pot_file(what: string, data: string | bigint): Promise<boolean> {
    const _data = l2Eth(data);
    return Promise.resolve(true);
  }

  // function approveClaim(address who, uint256 amount) public {
  //       claimToken.approve(who, amount);
  //   }
  async function approveClaim(
    account: Account,
    who: string,
    amount: string | number | bigint | BigNumber
  ) {
    await invoke(account, claimToken, 'approve', { spender: who, amount: l2Eth(amount).res });
  }

  //   function init_collateral(bytes32 name) internal returns (Ilk memory) {
  async function init_collateral(name: string): Promise<Ilk> {
    const _name = l2String(name);
    // MockToken coin = new MockToken("");
    const coin = await simpleDeployL2('mock_token', {}, hre);
    // coin.mint(500_000 ether);
    await invoke(admin, coin, 'mint', { account: _admin, amount: l2Eth(eth('500000')).res });
    // DSValue pip = new DSValue();
    const pip = await simpleDeployL2('ds_value', {}, hre);
    // spot.file(name, "pip", address(pip));
    await invoke(admin, spot, 'file', {
      ilk: _name,
      what: l2String('pip'),
      data: pip.address,
    });
    // spot.file(name, "mat", ray(2 ether));
    await invoke(admin, spot, 'file', {
      ilk: _name,
      what: l2String('mat'),
      data: ray(eth('2').toBigInt()),
    });
    // initial collateral price of 6
    // pip.poke(bytes32(6 * WAD));
    await invoke(admin, pip, 'poke', { wut: wad(6n) });
    // spot.poke(name);
    await invoke(admin, spot, 'poke', { ilk: _name });
    // vat.init(name);
    await admin.invoke(vat, 'init', { ilk: _name });
    // vat.file(name, "line", rad(1_000_000 ether));
    await admin.invoke(vat, 'file_ilk', {
      ilk: _name,
      what: l2String('line'),
      data: rad(eth('1000000').toBigInt()),
    });
    // GemJoin gemA = new GemJoin(address(vat), name, address(coin));
    const gemA = await simpleDeployL2(
      'gem_join',
      { vat: vat.address, ilk: _name, gem: coin.address, ward: _admin },
      hre
    );
    // coin.approve(address(gemA));
    await invoke(admin, coin, 'approve', {
      spender: gemA.address,
      amount: l2Eth(MAX).res,
    });
    // coin.approve(address(vat));
    await invoke(admin, coin, 'approve', {
      spender: vat.address,
      amount: l2Eth(MAX).res,
    });
    // vat.rely(address(gemA));
    await invoke(admin, vat, 'rely', { user: gemA.address });
    // ilks[name].pip = pip;
    // ilks[name].gem = coin;
    // ilks[name].gemA = gemA;
    ILKS.set(name, { pip, gem: coin, gemA });
    // return ilks[name];
    const _ilk = ILKS.get(name);
    if (!_ilk) throw Error('Error while calling init_collateral');
    return _ilk;
  }

  //   function testConstructor() public {
  it('test constructor', async () => {
    // assertEq(end.live(), 1);
    expect((await end.call('live')).res).to.equal(1n);
    // assertEq(end.wards(address(this)), 1);
    expect((await end.call('wards', { user: _admin })).res).to.equal(1n);
    // assertEq(address(end.vat()), address(vat));
    expect(l2Address((await end.call('vat')).res)).to.equal(vat.address);
  });

  //   function testAuth() public {
  it('test auth', async () => {
    // checkAuth(address(end), "End");
    await checkAuth(end, 'End');
  });

  //   function testFile() public {
  it('test file', async () => {});
  //       checkFileUint(address(end), "End", ["wait"]);
  //       checkFileAddress(address(end), "End", ["vow", "pot", "spot", "cure", "claim"]);
  //   }

  //   function testAuthModifier() public {
  it('test auth modifier', async () => {
    // end.deny(address(this));
    await invoke(admin, end, 'deny', { user: _admin });
    // bytes[] memory funcs = new bytes[](1);
    // funcs[0] = abi.encodeWithSignature("cage()", 0, 0, 0, 0);
    const funcs: any[][] = [['cage', {}]];
    // for (uint256 i = 0; i < funcs.length; i++) {
    for (let i = 0; i < funcs.length; i++) {
      try {
        //     assertRevert(address(end), funcs[i], "End/not-authorized");
        await invoke(admin, end, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('End/not-authorized');
      }
    }
  });

  //   function testLive() public {
  it('test live', async () => {
    // bytes[] memory funcs = new bytes[](3);
    // funcs[0] = abi.encodeWithSignature("cage(bytes32)", 0, 0, 0, 0);
    // funcs[1] = abi.encodeWithSelector(End.free.selector, 0, 0, 0, 0);
    // funcs[2] = abi.encodeWithSelector(End.thaw.selector, 0, 0, 0, 0);
    const funcs: any[][] = [
      ['cage', {}],
      ['free', { ilk: 0 }],
      ['thaw', {}],
    ];

    // for (uint256 i = 0; i < funcs.length; i++) {
    for (let i = 0; i < funcs.length; i++) {
      try {
        // assertRevert(address(end), funcs[i], "End/still-live");
        await invoke(admin, end, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('End/still-live');
      }
    }

    // end.cage();
    await invoke(admin, end, 'cage');

    // {
    //     bytes[] memory funcs = new bytes[](3);
    //     funcs[0] = abi.encodeWithSignature("file(bytes32,address)", 0, 0, 0, 0);
    //     funcs[1] = abi.encodeWithSignature("file(bytes32,uint256)", 0, 0, 0, 0);
    //     funcs[2] = abi.encodeWithSignature("cage()", 0, 0, 0, 0);

    //     for (uint256 i = 0; i < funcs.length; i++) {
    //         assertRevert(address(end), funcs[i], "End/not-live");
    //     }
    // }
    const funcs2: any[][] = [
      ['file', { what: 0, data: 0 }],
      ['file_wait', { what: 0, data: 0 }],
      ['cage', {}],
    ];

    for (let i = 0; i < funcs2.length; i++) {
      try {
        await invoke(admin, end, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('End/not-live');
      }
    }
  });

  //   function testCageBasic() public {
  it('test cage basic', async () => {
    // assertEq(end.live(), 1);
    expect((await end.call('live')).res).to.equal(1n);
    // assertEq(vat.live(), 1);
    expect((await vat.call('live')).res).to.equal(1n);
    // assertEq(pot.live(), 1);
    expect((await pot.call('live')).res).to.equal(1n);
    // assertEq(spot.live(), 1);
    expect((await spot.call('live')).res).to.equal(1n);
    // vm.expectEmit(true, true, true, true);
    // emit Cage();
    // end.cage();
    await invoke(admin, end, 'cage');
    // assertEq(end.live(), 0);
    // assertEq(vat.live(), 0);
    // assertEq(pot.live(), 0);
    // assertEq(spot.live(), 0);
    expect((await end.call('live')).res).to.equal(0n);
    expect((await vat.call('live')).res).to.equal(0n);
    expect((await pot.call('live')).res).to.equal(0n);
    expect((await spot.call('live')).res).to.equal(0n);
  });

  //   function testCagePotDrip() public {
  it('test cage pot drip', async () => {
    // assertEq(pot.live(), 1);
    expect((await pot.call('live')).res).to.equal(1n);
    // pot.drip();
    await invoke(admin, pot, 'drip');
    // end.cage();
    await invoke(admin, end, 'cage');
    // assertEq(pot.live(), 0);
    expect((await pot.call('live')).res).to.equal(0n);
    // assertEq(pot.dsr(), 10 ** 27);
    expect(await pot.call('dsr')).to.deep.equal(l2Eth(RAY));
    // assertTrue(!try_pot_file("dsr", 10 ** 27 + 1));
    expect(await try_pot_file('dsr', RAY + 1n)).to.be.false;
  });

  //   // -- Scenario where there is one over-collateralised CDP
  //   // -- and there is no Vow deficit or surplus
  //   function testCageCollateralised() public {
  it('test cage collateral', async () => {
    // Ilk memory gold = init_collateral("gold");
    const gold = await init_collateral('gold');
    // Usr ali = new Usr(vat, end);
    // // make a CDP:
    // address urn1 = address(ali);
    const urn1 = user1.address;
    // gold.gemA.join(urn1, 10 ether);
    await invoke(admin, gold.gemA, 'join', { user: urn1, wad: l2Eth(eth('10')).res });
    // ali.frob("gold", urn1, urn1, urn1, 10 ether, 15 ether);
    await frob(user1, 'gold', urn1, urn1, urn1, l2Eth(eth('10')).res, l2Eth(eth('10')).res);
    // ali's urn has 0 gem, 10 ink, 15 tab, 15 dai

    // global checks:
    // assertEq(vat.debt(), rad(15 ether));
    // assertEq(vat.vice(), 0);
    expect((await vat.call('debt')).debt).to.deep.equal(rad(eth('15').toBigInt()));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(0n));
    // // collateral price is 5
    // gold.pip.poke(bytes32(5 * WAD));
    await invoke(admin, gold.pip, 'poke', { wut: wad(5n) });
    // end.cage();
    await invoke(admin, end, 'cage');
    // vm.expectEmit(true, true, true, true);
    // emit Cage("gold");
    // end.cage("gold");
    await invoke(admin, end, 'cage_ilk', { ilk: l2String('gold') });
    // vm.expectEmit(true, true, true, true);
    // emit Skim("gold", urn1, 3 ether, 15 ether);
    // end.skim("gold", urn1);
    await invoke(admin, end, 'skim', { ilk: l2String('gold'), urn: urn1 });

    // // local checks:
    // assertEq(art("gold", urn1), 0);
    // assertEq(ink("gold", urn1), 7 ether);
    // assertEq(vat.sin(address(vow)), rad(15 ether));
    expect(await art('gold', urn1)).to.deep.equal(l2Eth(0n));
    expect(await ink('gold', urn1)).to.deep.equal(l2Eth(eth('7')));
    expect((await vat.call('sin', { u: vow.address })).sin).to.deep.equal(
      rad(eth('15').toBigInt())
    );

    // // global checks:
    // assertEq(vat.debt(), rad(15 ether));
    // assertEq(vat.vice(), rad(15 ether));
    expect((await vat.call('debt')).debt).to.deep.equal(rad(eth('15').toBigInt()));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(eth('15').toBigInt()));
    // // CDP closing
    // vm.expectEmit(true, true, true, true);
    // emit Free("gold", address(ali), 7 ether);
    // ali.free("gold");
    // assertEq(ink("gold", urn1), 0);
    // assertEq(gem("gold", urn1), 7 ether);
    // ali.exit(gold.gemA, address(this), 7 ether);
    await invoke(user1, end, 'free', { ilk: l2String('gold') });
    expect(await ink('gold', urn1)).to.deep.equal(rad(0n));
    expect(await gem('gold', urn1)).to.deep.equal(uint(eth('7').toBigInt()));
    await invoke(user1, gold.gemA, 'exit', { user: _admin, wad: l2Eth(eth('7')).res });
    // vm.warp(block.timestamp + 1 hours);
    await starknet.devnet.increaseTime(new Date().getTime() * 1000 + 3600);
    await starknet.devnet.createBlock();
    // vm.expectEmit(true, true, true, true);
    // emit Thaw();
    // end.thaw();
    await invoke(admin, end, 'thaw');
    // vm.expectEmit(true, true, true, true);
    // emit Flow("gold");
    // end.flow("gold");
    await invoke(admin, end, 'flow', { ilk: l2String('gold') });
    // assertTrue(end.fix("gold") != 0);
    expect(await end.call('fix', { ilk: l2String('gold') })).to.not.be.deep.equal(l2Eth(0n));
    // // dai redemption
    // claimToken.mint(address(ali), 15 ether);
    // ali.approveClaim(address(end), 15 ether);
    // vm.expectEmit(true, true, true, true);
    // emit Pack(address(ali), 15 ether);
    // ali.pack(15 ether);
    await invoke(admin, claimToken, 'mint', {
      account: user1.address,
      amount: l2Eth(eth('15')).res,
    });
    await approveClaim(user1, end.address, eth('15'));
    await invoke(user1, end, 'pack', { wad: l2Eth(eth('15')).res });
    // // global checks:
    // assertEq(vat.debt(), rad(15 ether));
    // assertEq(vat.vice(), rad(15 ether));
    // assertEq(vat.sin(address(vow)), rad(15 ether));
    // assertEq(claimToken.balanceOf(address(vow)), 15 ether);
    expect((await vat.call('debt')).debt).to.deep.equal(rad(eth('15').toBigInt()));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(eth('15').toBigInt()));
    expect((await vat.call('sin', { u: vow.address })).sin).to.deep.equal(
      rad(eth('15').toBigInt())
    );
    expect(await claimToken.call('balanceOf', { user: vow.address })).to.deep.equal(
      l2Eth(eth('15')).res
    );
    // vm.expectEmit(true, true, true, true);
    // emit Cash("gold", address(ali), 15 ether);
    // ali.cash("gold", 15 ether);
    await invoke(user1, end, 'cash', { ilk: l2String('gold'), wad: l2Eth(eth('15')).res });

    // // local checks:
    // assertEq(dai(urn1), 15 ether);
    // assertEq(gem("gold", urn1), 3 ether);
    // ali.exit(gold.gemA, address(this), 3 ether);
    expect(await dai(urn1)).to.deep.equal(uint(eth('15').toBigInt()));
    expect(await gem('gold', urn1)).to.deep.equal(uint(eth('3').toBigInt()));
    await invoke(user1, gold.gemA, 'exit', { user: _admin, wad: l2Eth(eth('3')).res });

    // assertEq(gem("gold", address(end)), 0);
    expect(await gem('gold', end.address)).to.deep.equal(uint(0n));
    // assertEq(balanceOf("gold", address(gold.gemA)), 0);
    expect(await balanceOf('gold', gold.gemA.address)).to.deep.equal(uint(0n));
  });

  //   // -- Scenario where there is one over-collateralised and one
  //   // -- under-collateralised CDP, and no Vow deficit or surplus
  //   function testCageUndercollateralised() public {
  it('test cage undercollateralised', async () => {
    // Ilk memory gold = init_collateral("gold");
    const gold: Ilk = await init_collateral('gold');
    // Usr ali = new Usr(vat, end);
    // Usr bob = new Usr(vat, end);
    // // make a CDP:
    // address urn1 = address(ali);
    const urn1 = user1.address;
    // gold.gemA.join(urn1, 10 ether);
    // ali.frob("gold", urn1, urn1, urn1, 10 ether, 15 ether);
    await invoke(admin, gold.gemA, 'join', { user: urn1, wad: l2Eth(eth('10')).res });
    await frob(user1, 'gold', urn1, urn1, urn1, l2Eth(eth('10')).res, l2Eth(eth('15')).res);
    // // ali's urn has 0 gem, 10 ink, 15 tab, 15 dai
    // // make a second CDP:
    // address urn2 = address(bob);
    const urn2 = user2.address;
    // gold.gemA.join(urn2, 1 ether);
    // bob.frob("gold", urn2, urn2, urn2, 1 ether, 3 ether);
    await invoke(admin, gold.gemA, 'join', { user: urn2, wad: l2Eth(eth('1')).res });
    await frob(user1, 'gold', urn1, urn1, urn1, l2Eth(eth('10')).res, l2Eth(eth('15')).res);
    // // bob's urn has 0 gem, 1 ink, 3 tab, 3 dai
    // // global checks:
    // assertEq(vat.debt(), rad(18 ether));
    // assertEq(vat.vice(), 0);
    expect((await vat.call('debt')).debt).to.deep.equal(rad(eth('18').toBigInt()));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(0n));
    // // collateral price is 2
    // gold.pip.poke(bytes32(2 * WAD));
    await invoke(admin, gold.pip, 'poke', { wut: wad(2n) });
    // end.cage();
    await invoke(admin, end, 'cage');
    // end.cage("gold");
    await invoke(admin, end, 'cage_ilk', { ilk: l2String('gold') });
    // end.skim("gold", urn1);  // over-collateralised
    await invoke(admin, end, 'skim', { ilk: l2String('gold'), urn: urn1 });
    // end.skim("gold", urn2);  // under-collateralised
    await invoke(admin, end, 'skim', { ilk: l2String('gold'), urn: urn2 });

    // // local checks
    // assertEq(art("gold", urn1), 0);
    // assertEq(ink("gold", urn1), 2.5 ether);
    // assertEq(art("gold", urn2), 0);
    // assertEq(ink("gold", urn2), 0);
    // assertEq(vat.sin(address(vow)), rad(18 ether));
    expect(await art('gold', urn1)).to.deep.equal(l2Eth(0n));
    expect(await ink('gold', urn1)).to.deep.equal(l2Eth(eth('2.5')));
    expect(await art('gold', urn2)).to.deep.equal(l2Eth(0n));
    expect(await ink('gold', urn2)).to.deep.equal(l2Eth(0n));
    expect((await vat.call('sin', { u: vow.address })).sin).to.deep.equal(
      rad(eth('18').toBigInt())
    );

    // // global checks
    // assertEq(vat.debt(), rad(18 ether));
    // assertEq(vat.vice(), rad(18 ether));
    expect((await vat.call('debt')).debt).to.deep.equal(rad(eth('18').toBigInt()));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(eth('18').toBigInt()));
    // // CDP closing
    // ali.free("gold");
    // assertEq(ink("gold", urn1), 0);
    // assertEq(gem("gold", urn1), 2.5 ether);
    // ali.exit(gold.gemA, address(this), 2.5 ether);
    await invoke(user1, end, 'free', { ilk: l2String('gold') });
    expect(await ink('gold', urn1)).to.deep.equal(rad(0n));
    expect(await gem('gold', urn1)).to.deep.equal(uint(eth('2.5').toBigInt()));
    await invoke(user1, gold.gemA, 'exit', { user: _admin, wad: l2Eth(eth('2.5')).res });
    // vm.warp(block.timestamp + 1 hours);
    await starknet.devnet.increaseTime(new Date().getTime() * 1000 + 3600);
    await starknet.devnet.createBlock();
    // end.thaw();
    await invoke(admin, end, 'thaw');
    // end.flow("gold");
    await invoke(admin, end, 'flow', { ilk: l2String('gold') });
    // assertTrue(end.fix("gold") != 0);
    expect(await end.call('fix', { ilk: l2String('gold') })).to.not.be.deep.equal(l2Eth(0n));

    // // first dai redemption
    // claimToken.mint(address(ali), 15 ether);
    // ali.approveClaim(address(end), 15 ether);
    // ali.pack(15 ether);
    await invoke(admin, claimToken, 'mint', {
      account: user1.address,
      amount: l2Eth(eth('15')).res,
    });
    await approveClaim(user1, end.address, eth('15'));
    await invoke(user1, end, 'pack', { wad: l2Eth(eth('15')).res });
    // // global checks:
    // assertEq(vat.debt(), rad(18 ether));
    // assertEq(vat.vice(), rad(18 ether));
    // assertEq(vat.sin(address(vow)), rad(18 ether));
    // assertEq(claimToken.balanceOf(address(vow)), 15 ether);
    expect((await vat.call('debt')).debt).to.deep.equal(rad(eth('18').toBigInt()));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(eth('18').toBigInt()));
    expect((await vat.call('sin', { u: vow.address })).sin).to.deep.equal(
      rad(eth('18').toBigInt())
    );
    expect(await claimToken.call('balanceOf', { user: vow.address })).to.deep.equal(
      l2Eth(eth('15')).res
    );
    // ali.cash("gold", 15 ether);
    await invoke(user1, end, 'cash', { ilk: l2String('gold'), wad: l2Eth(eth('15')).res });

    // // local checks:
    // assertEq(dai(urn1), 15 ether);
    expect(await dai(urn1)).to.deep.equal(uint(eth('15').toBigInt()));
    // uint256 fix = end.fix("gold");
    // assertEq(gem("gold", urn1), rmul(fix, 15 ether));
    // ali.exit(gold.gemA, address(this), rmul(fix, 15 ether));
    const { res } = await end.call('fix', { ilk: l2String('gold') });
    const _fix: SplitUint = new SplitUint(res);
    const fix = uint((_fix.toUint() * eth('15').toBigInt()) / RAY);
    expect(await gem('gold', urn1)).to.deep.equal(fix);
    await invoke(user1, gold.gemA, 'exit', { user: _admin, wad: fix });

    // // second dai redemption
    // claimToken.mint(address(bob), 3 ether);
    // bob.approveClaim(address(end), 3 ether);
    // bob.pack(3 ether);
    await invoke(admin, claimToken, 'mint', {
      account: user2.address,
      amount: l2Eth(eth('3')).res,
    });
    await approveClaim(user1, end.address, eth('3'));
    await invoke(user1, end, 'pack', { wad: l2Eth(eth('3')).res });

    // // global checks:
    // assertEq(vat.debt(), rad(18 ether));
    // assertEq(vat.vice(), rad(18 ether));
    // assertEq(vat.sin(address(vow)), rad(18 ether));
    // assertEq(claimToken.balanceOf(address(vow)), 18 ether);
    expect((await vat.call('debt')).debt).to.deep.equal(rad(eth('18').toBigInt()));
    expect((await vat.call('vice')).vice).to.deep.equal(rad(eth('18').toBigInt()));
    expect((await vat.call('sin', { u: vow.address })).sin).to.deep.equal(
      rad(eth('18').toBigInt())
    );
    expect(await claimToken.call('balanceOf', { user: vow.address })).to.deep.equal(
      l2Eth(eth('18')).res
    );

    // bob.cash("gold", 3 ether);
    await invoke(user2, end, 'cash', { ilk: l2String('gold'), wad: l2Eth(eth('3')).res });

    // // local checks:
    // assertEq(dai(urn2), 3 ether);
    // assertEq(gem("gold", urn2), rmul(fix, 3 ether));
    // bob.exit(gold.gemA, address(this), rmul(fix, 3 ether));
    expect(await dai(urn2)).to.deep.equal(uint(eth('3').toBigInt()));
    const { res: res2 } = await end.call('fix', { ilk: l2String('gold') });
    const _fix2: SplitUint = new SplitUint(res2);
    const fix2 = uint((_fix2.toUint() * eth('3').toBigInt()) / RAY);
    expect(await gem('gold', urn2)).to.deep.equal(fix2);
    await invoke(user2, gold.gemA, 'exit', { user: _admin, wad: fix2 });

    // // some dust remains in the End because of rounding:
    // assertEq(gem("gold", address(end)), 1);
    expect(await gem('gold', end.address)).to.deep.equal(uint(1n));
    // assertEq(balanceOf("gold", address(gold.gemA)), 1);
    expect(await balanceOf('gold', gold.gemA.address)).to.deep.equal(1n);
  });

  //   // -- Scenario where there is one over-collateralised CDP
  //   // -- and there is a deficit in the Vow
  //   function testCageCollateralisedDeficit() public {
  //       Ilk memory gold = init_collateral("gold");

  //       Usr ali = new Usr(vat, end);

  //       // make a CDP:
  //       address urn1 = address(ali);
  //       gold.gemA.join(urn1, 10 ether);
  //       ali.frob("gold", urn1, urn1, urn1, 10 ether, 15 ether);
  //       // ali's urn has 0 gem, 10 ink, 15 tab, 15 dai
  //       // suck 1 dai and give to ali
  //       vat.suck(address(vow), address(ali), rad(1 ether));

  //       // global checks:
  //       assertEq(vat.debt(), rad(16 ether));
  //       assertEq(vat.vice(), rad(1 ether));

  //       // collateral price is 5
  //       gold.pip.poke(bytes32(5 * WAD));
  //       end.cage();
  //       end.cage("gold");
  //       end.skim("gold", urn1);

  //       // local checks:
  //       assertEq(art("gold", urn1), 0);
  //       assertEq(ink("gold", urn1), 7 ether);
  //       assertEq(vat.sin(address(vow)), rad(16 ether));

  //       // global checks:
  //       assertEq(vat.debt(), rad(16 ether));
  //       assertEq(vat.vice(), rad(16 ether));

  //       // CDP closing
  //       ali.free("gold");
  //       assertEq(ink("gold", urn1), 0);
  //       assertEq(gem("gold", urn1), 7 ether);
  //       ali.exit(gold.gemA, address(this), 7 ether);

  //       vm.warp(block.timestamp + 1 hours);
  //       end.thaw();
  //       end.flow("gold");
  //       assertTrue(end.fix("gold") != 0);

  //       // dai redemption
  //       claimToken.mint(address(ali), 16 ether);
  //       ali.approveClaim(address(end), 16 ether);
  //       ali.pack(16 ether);

  //       // global checks:
  //       assertEq(vat.debt(), rad(16 ether));
  //       assertEq(vat.vice(), rad(16 ether));
  //       assertEq(vat.sin(address(vow)), rad(16 ether));
  //       assertEq(claimToken.balanceOf(address(vow)), 16 ether);

  //       ali.cash("gold", 16 ether);

  //       // local checks:
  //       assertEq(dai(urn1), 16 ether);
  //       assertEq(gem("gold", urn1), 3 ether);
  //       ali.exit(gold.gemA, address(this), 3 ether);

  //       assertEq(gem("gold", address(end)), 0);
  //       assertEq(balanceOf("gold", address(gold.gemA)), 0);
  //   }

  //   // -- Scenario where there is one over-collateralised CDP
  //   // -- and one under-collateralised CDP and there is a
  //   // -- surplus in the Vow
  //   function testCageUndercollateralisedSurplus() public {
  //       Ilk memory gold = init_collateral("gold");

  //       Usr ali = new Usr(vat, end);
  //       Usr bob = new Usr(vat, end);

  //       // make a CDP:
  //       address urn1 = address(ali);
  //       gold.gemA.join(urn1, 10 ether);
  //       ali.frob("gold", urn1, urn1, urn1, 10 ether, 15 ether);
  //       // ali's urn has 0 gem, 10 ink, 15 tab, 15 dai
  //       // alive gives one dai to the vow, creating surplus
  //       ali.move(address(ali), address(vow), rad(1 ether));

  //       // make a second CDP:
  //       address urn2 = address(bob);
  //       gold.gemA.join(urn2, 1 ether);
  //       bob.frob("gold", urn2, urn2, urn2, 1 ether, 3 ether);
  //       // bob's urn has 0 gem, 1 ink, 3 tab, 3 dai

  //       // global checks:
  //       assertEq(vat.debt(), rad(18 ether));
  //       assertEq(vat.vice(), 0);

  //       // collateral price is 2
  //       gold.pip.poke(bytes32(2 * WAD));
  //       end.cage();
  //       end.cage("gold");
  //       end.skim("gold", urn1);  // over-collateralised
  //       end.skim("gold", urn2);  // under-collateralised

  //       // local checks
  //       assertEq(art("gold", urn1), 0);
  //       assertEq(ink("gold", urn1), 2.5 ether);
  //       assertEq(art("gold", urn2), 0);
  //       assertEq(ink("gold", urn2), 0);
  //       assertEq(vat.sin(address(vow)), rad(18 ether));

  //       // global checks
  //       assertEq(vat.debt(), rad(18 ether));
  //       assertEq(vat.vice(), rad(18 ether));

  //       // CDP closing
  //       ali.free("gold");
  //       assertEq(ink("gold", urn1), 0);
  //       assertEq(gem("gold", urn1), 2.5 ether);
  //       ali.exit(gold.gemA, address(this), 2.5 ether);

  //       vm.warp(block.timestamp + 1 hours);
  //       // balance the vow
  //       vow.heal(rad(1 ether));
  //       end.thaw();
  //       end.flow("gold");
  //       assertTrue(end.fix("gold") != 0);

  //       // first dai redemption
  //       claimToken.mint(address(ali), 14 ether);
  //       ali.approveClaim(address(end), 14 ether);
  //       ali.pack(14 ether);

  //       // global checks:
  //       assertEq(vat.debt(), rad(17 ether));
  //       assertEq(vat.vice(), rad(17 ether));

  //       ali.cash("gold", 14 ether);

  //       // local checks:
  //       assertEq(dai(urn1), 14 ether);
  //       uint256 fix = end.fix("gold");
  //       assertEq(gem("gold", urn1), rmul(fix, 14 ether));
  //       ali.exit(gold.gemA, address(this), rmul(fix, 14 ether));

  //       // second dai redemption
  //       claimToken.mint(address(bob), 16 ether);
  //       bob.approveClaim(address(end), 16 ether);
  //       bob.pack(3 ether);

  //       // global checks:
  //       assertEq(vat.debt(), rad(17 ether));
  //       assertEq(vat.vice(), rad(17 ether));

  //       bob.cash("gold", 3 ether);

  //       // local checks:
  //       assertEq(dai(urn2), 3 ether);
  //       assertEq(gem("gold", urn2), rmul(fix, 3 ether));
  //       bob.exit(gold.gemA, address(this), rmul(fix, 3 ether));

  //       // nothing left in the End
  //       assertEq(gem("gold", address(end)), 0);
  //       assertEq(balanceOf("gold", address(gold.gemA)), 0);
  //   }

  //   // -- Scenario where there is one over-collateralised and one
  //   // -- under-collateralised CDP of different collateral types
  //   // -- and no Vow deficit or surplus
  //   function testCageNetUndercollateralisedMultipleIlks() public {
  //       Ilk memory gold = init_collateral("gold");
  //       Ilk memory coal = init_collateral("coal");

  //       Usr ali = new Usr(vat, end);
  //       Usr bob = new Usr(vat, end);

  //       // make a CDP:
  //       address urn1 = address(ali);
  //       gold.gemA.join(urn1, 10 ether);
  //       ali.frob("gold", urn1, urn1, urn1, 10 ether, 15 ether);
  //       // ali's urn has 0 gem, 10 ink, 15 tab

  //       // make a second CDP:
  //       address urn2 = address(bob);
  //       coal.gemA.join(urn2, 1 ether);
  //       vat.file("coal", "spot", ray(5 ether));
  //       bob.frob("coal", urn2, urn2, urn2, 1 ether, 5 ether);
  //       // bob's urn has 0 gem, 1 ink, 5 tab

  //       gold.pip.poke(bytes32(2 * WAD));
  //       // urn1 has 20 dai of ink and 15 dai of tab
  //       coal.pip.poke(bytes32(2 * WAD));
  //       // urn2 has 2 dai of ink and 5 dai of tab
  //       end.cage();
  //       end.cage("gold");
  //       end.cage("coal");
  //       end.skim("gold", urn1);  // over-collateralised
  //       end.skim("coal", urn2);  // under-collateralised

  //       vm.warp(block.timestamp + 1 hours);
  //       end.thaw();
  //       end.flow("gold");
  //       end.flow("coal");

  //       claimToken.mint(address(ali), 1000 ether);
  //       ali.approveClaim(address(end), type(uint256).max);
  //       claimToken.mint(address(bob), 1000 ether);
  //       bob.approveClaim(address(end), type(uint256).max);

  //       assertEq(vat.debt(),             rad(20 ether));
  //       assertEq(vat.vice(),             rad(20 ether));
  //       assertEq(vat.sin(address(vow)),  rad(20 ether));

  //       assertEq(end.Art("gold"), 15 ether);
  //       assertEq(end.Art("coal"),  5 ether);

  //       assertEq(end.gap("gold"),  0.0 ether);
  //       assertEq(end.gap("coal"),  1.5 ether);

  //       // there are 7.5 gold and 1 coal
  //       // the gold is worth 15 dai and the coal is worth 2 dai
  //       // the total collateral pool is worth 17 dai
  //       // the total outstanding debt is 20 dai
  //       // each dai should get (15/2)/20 gold and (2/2)/20 coal
  //       assertEq(end.fix("gold"), ray(0.375 ether));
  //       assertEq(end.fix("coal"), ray(0.050 ether));

  //       assertEq(gem("gold", address(ali)), 0 ether);
  //       ali.pack(1 ether);
  //       ali.cash("gold", 1 ether);
  //       assertEq(gem("gold", address(ali)), 0.375 ether);

  //       bob.pack(1 ether);
  //       bob.cash("coal", 1 ether);
  //       assertEq(gem("coal", address(bob)), 0.05 ether);

  //       ali.exit(gold.gemA, address(ali), 0.375 ether);
  //       bob.exit(coal.gemA, address(bob), 0.05  ether);
  //       ali.pack(1 ether);
  //       ali.cash("gold", 1 ether);
  //       ali.cash("coal", 1 ether);
  //       assertEq(gem("gold", address(ali)), 0.375 ether);
  //       assertEq(gem("coal", address(ali)), 0.05 ether);

  //       ali.exit(gold.gemA, address(ali), 0.375 ether);
  //       ali.exit(coal.gemA, address(ali), 0.05  ether);

  //       ali.pack(1 ether);
  //       ali.cash("gold", 1 ether);
  //       assertEq(end.out("gold", address(ali)), 3 ether);
  //       assertEq(end.out("coal", address(ali)), 1 ether);
  //       ali.pack(1 ether);
  //       ali.cash("coal", 1 ether);
  //       assertEq(end.out("gold", address(ali)), 3 ether);
  //       assertEq(end.out("coal", address(ali)), 2 ether);
  //       assertEq(gem("gold", address(ali)), 0.375 ether);
  //       assertEq(gem("coal", address(ali)), 0.05 ether);
  //   }

  //   // -- Scenario where flow() used to overflow
  //   function testOverflow() public {
  //       Ilk memory gold = init_collateral("gold");

  //       Usr ali = new Usr(vat, end);

  //       // make a CDP:
  //       address urn1 = address(ali);
  //       gold.gemA.join(urn1, 500_000 ether);
  //       ali.frob("gold", urn1, urn1, urn1, 500_000 ether, 1_000_000 ether);
  //       // ali's urn has 500_000 ink, 10^6 art (and 10^6 dai since rate == RAY)

  //       // global checks:
  //       assertEq(vat.debt(), rad(1_000_000 ether));
  //       assertEq(vat.vice(), 0);

  //       // collateral price is 5
  //       gold.pip.poke(bytes32(5 * WAD));
  //       end.cage();
  //       end.cage("gold");
  //       end.skim("gold", urn1);

  //       // local checks:
  //       assertEq(art("gold", urn1), 0);
  //       assertEq(ink("gold", urn1), 300_000 ether);
  //       assertEq(vat.sin(address(vow)), rad(1_000_000 ether));

  //       // global checks:
  //       assertEq(vat.debt(), rad(1_000_000 ether));
  //       assertEq(vat.vice(), rad(1_000_000 ether));

  //       // CDP closing
  //       ali.free("gold");
  //       assertEq(ink("gold", urn1), 0);
  //       assertEq(gem("gold", urn1), 300_000 ether);
  //       ali.exit(gold.gemA, address(this), 300_000 ether);

  //       vm.warp(block.timestamp + 1 hours);
  //       end.thaw();
  //       end.flow("gold");
  //   }
});
