import { BN, min } from 'bn.js';
import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { HttpNetworkConfig, StarknetContract } from 'hardhat/types';
import { BigNumberish } from 'starknet/utils/number';

import {
  asDec,
  eth,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  toBytes32,
  l2String,
  l2Address,
  SplitUintType,
  uint,
  invoke,
  ray,
  wad,
  rad,
} from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = '9379074284324409537785911406195';

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
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let end: any;
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

  it('test rely deny', async () => {
    await checkAuth(end, 'End');
  });

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
    const { gem } = await vat.call('gem', { i: ilk, u: urn });
    return gem;
  }
  //   function ink(bytes32 ilk, address urn) internal view returns (uint) {
  //       (uint256 ink_, uint256 art_) = vat.urns(ilk, urn); art_;
  //       return ink_;
  //   }
  async function ink(ilk: string, urn: string) {
    const { urn: _urn } = await vat.call('urns', {
      i: ilk,
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
      i: ilk,
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
  async function try_pot_file(what: string, data: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  //   function init_collateral(bytes32 name) internal returns (Ilk memory) {
  async function init_collateral(name: string): Promise<Ilk | undefined> {
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
    return ILKS.get(name);
  }

  //   function testConstructor() public {
  //       assertEq(end.live(), 1);
  //       assertEq(end.wards(address(this)), 1);
  //       assertEq(address(end.vat()), address(vat));
  //   }

  //   function testAuth() public {
  //       checkAuth(address(end), "End");
  //   }

  //   function testFile() public {
  //       checkFileUint(address(end), "End", ["wait"]);
  //       checkFileAddress(address(end), "End", ["vow", "pot", "spot", "cure", "claim"]);
  //   }

  //   function testAuthModifier() public {
  //       end.deny(address(this));

  //       bytes[] memory funcs = new bytes[](1);
  //       funcs[0] = abi.encodeWithSignature("cage()", 0, 0, 0, 0);

  //       for (uint256 i = 0; i < funcs.length; i++) {
  //           assertRevert(address(end), funcs[i], "End/not-authorized");
  //       }
  //   }

  //   function testLive() public {
  //       {
  //           bytes[] memory funcs = new bytes[](3);
  //           funcs[0] = abi.encodeWithSignature("cage(bytes32)", 0, 0, 0, 0);
  //           funcs[1] = abi.encodeWithSelector(End.free.selector, 0, 0, 0, 0);
  //           funcs[2] = abi.encodeWithSelector(End.thaw.selector, 0, 0, 0, 0);

  //           for (uint256 i = 0; i < funcs.length; i++) {
  //               assertRevert(address(end), funcs[i], "End/still-live");
  //           }
  //       }

  //       end.cage();

  //       {
  //           bytes[] memory funcs = new bytes[](3);
  //           funcs[0] = abi.encodeWithSignature("file(bytes32,address)", 0, 0, 0, 0);
  //           funcs[1] = abi.encodeWithSignature("file(bytes32,uint256)", 0, 0, 0, 0);
  //           funcs[2] = abi.encodeWithSignature("cage()", 0, 0, 0, 0);

  //           for (uint256 i = 0; i < funcs.length; i++) {
  //               assertRevert(address(end), funcs[i], "End/not-live");
  //           }
  //       }
  //   }

  //   function testCageBasic() public {
  //       assertEq(end.live(), 1);
  //       assertEq(vat.live(), 1);
  //       assertEq(pot.live(), 1);
  //       assertEq(spot.live(), 1);
  //       vm.expectEmit(true, true, true, true);
  //       emit Cage();
  //       end.cage();
  //       assertEq(end.live(), 0);
  //       assertEq(vat.live(), 0);
  //       assertEq(pot.live(), 0);
  //       assertEq(spot.live(), 0);
  //   }

  //   function testCagePotDrip() public {
  //       assertEq(pot.live(), 1);
  //       pot.drip();
  //       end.cage();

  //       assertEq(pot.live(), 0);
  //       assertEq(pot.dsr(), 10 ** 27);
  //       assertTrue(!try_pot_file("dsr", 10 ** 27 + 1));
  //   }

  //   // -- Scenario where there is one over-collateralised CDP
  //   // -- and there is no Vow deficit or surplus
  //   function testCageCollateralised() public {
  //       Ilk memory gold = init_collateral("gold");

  //       Usr ali = new Usr(vat, end);

  //       // make a CDP:
  //       address urn1 = address(ali);
  //       gold.gemA.join(urn1, 10 ether);
  //       ali.frob("gold", urn1, urn1, urn1, 10 ether, 15 ether);
  //       // ali's urn has 0 gem, 10 ink, 15 tab, 15 dai

  //       // global checks:
  //       assertEq(vat.debt(), rad(15 ether));
  //       assertEq(vat.vice(), 0);

  //       // collateral price is 5
  //       gold.pip.poke(bytes32(5 * WAD));
  //       end.cage();
  //       vm.expectEmit(true, true, true, true);
  //       emit Cage("gold");
  //       end.cage("gold");
  //       vm.expectEmit(true, true, true, true);
  //       emit Skim("gold", urn1, 3 ether, 15 ether);
  //       end.skim("gold", urn1);

  //       // local checks:
  //       assertEq(art("gold", urn1), 0);
  //       assertEq(ink("gold", urn1), 7 ether);
  //       assertEq(vat.sin(address(vow)), rad(15 ether));

  //       // global checks:
  //       assertEq(vat.debt(), rad(15 ether));
  //       assertEq(vat.vice(), rad(15 ether));

  //       // CDP closing
  //       vm.expectEmit(true, true, true, true);
  //       emit Free("gold", address(ali), 7 ether);
  //       ali.free("gold");
  //       assertEq(ink("gold", urn1), 0);
  //       assertEq(gem("gold", urn1), 7 ether);
  //       ali.exit(gold.gemA, address(this), 7 ether);

  //       vm.warp(block.timestamp + 1 hours);
  //       vm.expectEmit(true, true, true, true);
  //       emit Thaw();
  //       end.thaw();
  //       vm.expectEmit(true, true, true, true);
  //       emit Flow("gold");
  //       end.flow("gold");
  //       assertTrue(end.fix("gold") != 0);

  //       // dai redemption
  //       claimToken.mint(address(ali), 15 ether);
  //       ali.approveClaim(address(end), 15 ether);
  //       vm.expectEmit(true, true, true, true);
  //       emit Pack(address(ali), 15 ether);
  //       ali.pack(15 ether);

  //       // global checks:
  //       assertEq(vat.debt(), rad(15 ether));
  //       assertEq(vat.vice(), rad(15 ether));
  //       assertEq(vat.sin(address(vow)), rad(15 ether));
  //       assertEq(claimToken.balanceOf(address(vow)), 15 ether);

  //       vm.expectEmit(true, true, true, true);
  //       emit Cash("gold", address(ali), 15 ether);
  //       ali.cash("gold", 15 ether);

  //       // local checks:
  //       assertEq(dai(urn1), 15 ether);
  //       assertEq(gem("gold", urn1), 3 ether);
  //       ali.exit(gold.gemA, address(this), 3 ether);

  //       assertEq(gem("gold", address(end)), 0);
  //       assertEq(balanceOf("gold", address(gold.gemA)), 0);
  //   }

  //   // -- Scenario where there is one over-collateralised and one
  //   // -- under-collateralised CDP, and no Vow deficit or surplus
  //   function testCageUndercollateralised() public {
  //       Ilk memory gold = init_collateral("gold");

  //       Usr ali = new Usr(vat, end);
  //       Usr bob = new Usr(vat, end);

  //       // make a CDP:
  //       address urn1 = address(ali);
  //       gold.gemA.join(urn1, 10 ether);
  //       ali.frob("gold", urn1, urn1, urn1, 10 ether, 15 ether);
  //       // ali's urn has 0 gem, 10 ink, 15 tab, 15 dai

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
  //       end.thaw();
  //       end.flow("gold");
  //       assertTrue(end.fix("gold") != 0);

  //       // first dai redemption
  //       claimToken.mint(address(ali), 15 ether);
  //       ali.approveClaim(address(end), 15 ether);
  //       ali.pack(15 ether);

  //       // global checks:
  //       assertEq(vat.debt(), rad(18 ether));
  //       assertEq(vat.vice(), rad(18 ether));
  //       assertEq(vat.sin(address(vow)), rad(18 ether));
  //       assertEq(claimToken.balanceOf(address(vow)), 15 ether);

  //       ali.cash("gold", 15 ether);

  //       // local checks:
  //       assertEq(dai(urn1), 15 ether);
  //       uint256 fix = end.fix("gold");
  //       assertEq(gem("gold", urn1), rmul(fix, 15 ether));
  //       ali.exit(gold.gemA, address(this), rmul(fix, 15 ether));

  //       // second dai redemption
  //       claimToken.mint(address(bob), 3 ether);
  //       bob.approveClaim(address(end), 3 ether);
  //       bob.pack(3 ether);

  //       // global checks:
  //       assertEq(vat.debt(), rad(18 ether));
  //       assertEq(vat.vice(), rad(18 ether));
  //       assertEq(vat.sin(address(vow)), rad(18 ether));
  //       assertEq(claimToken.balanceOf(address(vow)), 18 ether);

  //       bob.cash("gold", 3 ether);

  //       // local checks:
  //       assertEq(dai(urn2), 3 ether);
  //       assertEq(gem("gold", urn2), rmul(fix, 3 ether));
  //       bob.exit(gold.gemA, address(this), rmul(fix, 3 ether));

  //       // some dust remains in the End because of rounding:
  //       assertEq(gem("gold", address(end)), 1);
  //       assertEq(balanceOf("gold", address(gold.gemA)), 1);
  //   }

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
