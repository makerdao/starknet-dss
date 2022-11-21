import { Account, StarknetContract } from 'hardhat/types';
import { expect } from 'chai';
import hre, { starknet } from 'hardhat';
import fs from 'fs';

import { l2Eth, simpleDeployL2, l2String, l2Address, invoke } from './utils';

const TEST_ADDRESS = '9379074284324409537785911406195';

const dumpFile = 'unittest-dump.dmp';

describe('cure', async function () {
  this.timeout(900_000);
  let admin: Account;
  let _admin: string;
  let ali: any;
  let _ali: string;
  let bob: any;
  let _bob: any;
  let cure: StarknetContract;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.address;
    ali = await starknet.deployAccount('OpenZeppelin');
    _ali = ali.starknetContract.address;
    bob = await starknet.deployAccount('OpenZeppelin');
    _bob = bob.starknetContract.address;
    cure = await simpleDeployL2(
      'cure',
      {
        ward: _admin,
      },
      hre
    );

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

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await invoke(admin, base, 'rely', { usr: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(1n);

    await invoke(admin, base, 'deny', { usr: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await invoke(admin, base, 'deny', { usr: _admin });

    try {
      await invoke(admin, base, 'rely', { usr: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }
    try {
      await invoke(admin, base, 'deny', { usr: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }

    // await GodMode.setWard(base.address, this, ward);
  }

  // function testConstructor() public {
  it('test constructor', async () => {
    // assertEq(cure.live(), 1);
    expect((await cure.call('live')).res).to.be.equal(1n);
    // assertEq(cure.wards(address(this)), 1);
    expect((await cure.call('wards', { user: _admin })).res).to.be.equal(1n);
  });

  // function testAuth() public {
  it('test auth', async () => {
    // checkAuth(address(cure), "Cure");
    await checkAuth(cure, 'Cure');
  });

  // function testFile() public {
  it('test file', async () => {
    // checkFileUint(address(cure), 'Cure', ['wait']);
    // await checkFileFelt(cure, 'Cure', ['wait']);
  });

  //  function testAuthModifier() public {
  it('test auth modifier', async () => {
    //     cure.deny(address(this));
    await invoke(admin, cure, 'deny', { usr: _admin });

    //     bytes[] memory funcs = new bytes[](3);
    //     funcs[0] = abi.encodeWithSelector(Cure.lift.selector, 0, 0, 0, 0);
    //     funcs[1] = abi.encodeWithSelector(Cure.drop.selector, 0, 0, 0, 0);
    //     funcs[2] = abi.encodeWithSelector(Cure.cage.selector, 0, 0, 0, 0);
    const funcs: any[][] = [
      ['lift', { src: 0 }],
      ['drop', { src: 0 }],
      ['cage', {}],
    ];
    //     for (uint256 i = 0; i < funcs.length; i++) {
    for (let i = 0; i < funcs.length; i++) {
      // assertRevert(address(cure), funcs[i], "Cure/not-authorized");
      try {
        await invoke(admin, cure, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('Cure/not-authorized');
      }
    }
  });

  // function testLive() public {
  it('test live', async () => {
    //       cure.cage();
    await invoke(admin, cure, 'cage');

    //       bytes[] memory funcs = new bytes[](6);
    //       funcs[0] = abi.encodeWithSelector(Cure.rely.selector, 0, 0, 0, 0);
    //       funcs[1] = abi.encodeWithSelector(Cure.deny.selector, 0, 0, 0, 0);
    //       funcs[2] = abi.encodeWithSelector(Cure.file.selector, 0, 0, 0, 0);
    //       funcs[3] = abi.encodeWithSelector(Cure.lift.selector, 0, 0, 0, 0);
    //       funcs[4] = abi.encodeWithSelector(Cure.drop.selector, 0, 0, 0, 0);
    //       funcs[5] = abi.encodeWithSelector(Cure.cage.selector, 0, 0, 0, 0);
    const funcs: any[][] = [
      ['rely', { usr: 0 }],
      ['deny', { usr: 0 }],
      ['file', { what: 0, data: 0n }],
      ['lift', { src: 0 }],
      ['drop', { src: 0 }],
      ['cage', {}],
    ];

    //       for (uint256 i = 0; i < funcs.length; i++) {
    for (let i = 0; i < funcs.length; i++) {
      try {
        //           assertRevert(address(cure), funcs[i], "Cure/not-live");
        await invoke(admin, cure, funcs[i][0], funcs[i][1]);
      } catch (err: any) {
        expect(err.message).to.contain('Cure/not-live');
      }
    }
  });

  // function testAddSourceDelSource() public {
  it('test add source del source', async () => {
    // assertEq(cure.tCount(), 0);
    expect((await cure.call('tCount')).res).to.equal(0n);
    // address addr1 = address(new SourceMock(0));
    // vm.expectEmit(true, true, true, true);
    // emit Lift(addr1);
    // cure.lift(addr1);
    // assertEq(cure.tCount(), 1);
    const { address: addr1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr1 });
    expect((await cure.call('tCount')).res).to.equal(1n);
    // address addr2 = address(new SourceMock(0));
    // vm.expectEmit(true, true, true, true);
    // emit Lift(addr2);
    // cure.lift(addr2);
    // assertEq(cure.tCount(), 2);
    const { address: addr2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr2 });
    expect((await cure.call('tCount')).res).to.equal(2n);

    // address addr3 = address(new SourceMock(0));
    const { address: addr3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    // cure.lift(addr3);
    await invoke(admin, cure, 'lift', { src: addr3 });
    // assertEq(cure.tCount(), 3);
    expect((await cure.call('tCount')).res).to.equal(3n);
    // assertEq(cure.srcs(0), addr1);
    // assertEq(cure.pos(addr1), 1);
    // assertEq(cure.srcs(1), addr2);
    // assertEq(cure.pos(addr2), 2);
    // assertEq(cure.srcs(2), addr3);
    // assertEq(cure.pos(addr3), 3);
    expect(l2Address((await cure.call('srcs', { index: 0n })).res)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).res).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).res)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).res).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).res)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).res).to.equal(3n);
    // vm.expectEmit(true, true, true, true);
    // emit Drop(addr3);
    // cure.drop(addr3);
    // assertEq(cure.tCount(), 2);
    // assertEq(cure.srcs(0), addr1);
    // assertEq(cure.pos(addr1), 1);
    // assertEq(cure.srcs(1), addr2);
    // assertEq(cure.pos(addr2), 2);
    await invoke(admin, cure, 'drop', { src: addr3 });
    expect((await cure.call('tCount')).res).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 0n })).res)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).res).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).res)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).res).to.equal(2n);
    // vm.expectEmit(true, true, true, true);
    // emit Lift(addr3);
    // cure.lift(addr3);
    // assertEq(cure.tCount(), 3);
    // assertEq(cure.srcs(0), addr1);
    // assertEq(cure.pos(addr1), 1);
    // assertEq(cure.srcs(1), addr2);
    // assertEq(cure.pos(addr2), 2);
    // assertEq(cure.srcs(2), addr3);
    // assertEq(cure.pos(addr3), 3);
    await invoke(admin, cure, 'lift', { src: addr3 });
    expect((await cure.call('tCount')).res).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).res)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).res).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).res)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).res).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).res)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).res).to.equal(3n);
    // vm.expectEmit(true, true, true, true);
    // emit Drop(addr1);
    // cure.drop(addr1);
    // assertEq(cure.tCount(), 2);
    // assertEq(cure.srcs(0), addr3);
    // assertEq(cure.pos(addr3), 1);
    // assertEq(cure.srcs(1), addr2);
    // assertEq(cure.pos(addr2), 2);
    await invoke(admin, cure, 'drop', { src: addr1 });
    expect((await cure.call('tCount')).res).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 0n })).res)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).res).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).res)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).res).to.equal(2n);
    // vm.expectEmit(true, true, true, true);
    // emit Lift(addr1);
    // cure.lift(addr1);
    await invoke(admin, cure, 'lift', { src: addr1 });
    expect((await cure.call('tCount')).res).to.equal(3n);
    // assertEq(cure.tCount(), 3);
    // assertEq(cure.srcs(0), addr3);
    // assertEq(cure.pos(addr3), 1);
    // assertEq(cure.srcs(1), addr2);
    // assertEq(cure.pos(addr2), 2);
    // assertEq(cure.srcs(2), addr1);
    // assertEq(cure.pos(addr1), 3);
    expect(l2Address((await cure.call('srcs', { index: 0n })).res)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).res).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).res)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).res).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).res)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).res).to.equal(3n);
    // address addr4 = address(new SourceMock(0));
    const { address: addr4 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    // vm.expectEmit(true, true, true, true);
    // emit Lift(addr4);
    // cure.lift(addr4);
    await invoke(admin, cure, 'lift', { src: addr4 });
    // assertEq(cure.tCount(), 4);
    expect((await cure.call('tCount')).res).to.equal(4n);
    // assertEq(cure.srcs(0), addr3);
    // assertEq(cure.pos(addr3), 1);
    // assertEq(cure.srcs(1), addr2);
    // assertEq(cure.pos(addr2), 2);
    // assertEq(cure.srcs(2), addr1);
    // assertEq(cure.pos(addr1), 3);
    // assertEq(cure.srcs(3), addr4);
    // assertEq(cure.pos(addr4), 4);
    expect(l2Address((await cure.call('srcs', { index: 0n })).res)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).res).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).res)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).res).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).res)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).res).to.equal(3n);
    expect(l2Address((await cure.call('srcs', { index: 3n })).res)).to.equal(addr4);
    expect((await cure.call('pos', { src: addr4 })).res).to.equal(4n);
    // vm.expectEmit(true, true, true, true);
    // emit Drop(addr2);
    // cure.drop(addr2);
    await invoke(admin, cure, 'drop', { src: addr2 });
    expect((await cure.call('tCount')).res).to.equal(3n);
    // assertEq(cure.tCount(), 3);
    // assertEq(cure.srcs(0), addr3);
    // assertEq(cure.pos(addr3), 1);
    // assertEq(cure.srcs(1), addr4);
    // assertEq(cure.pos(addr4), 2);
    // assertEq(cure.srcs(2), addr1);
    // assertEq(cure.pos(addr1), 3);
    expect(l2Address((await cure.call('srcs', { index: 0n })).res)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).res).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).res)).to.equal(addr4);
    expect((await cure.call('pos', { src: addr4 })).res).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).res)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).res).to.equal(3n);
  });

  xit('test fail add source auth', async () => {
    await invoke(admin, cure, 'deny', { usr: _admin });
    const { address: addr } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    try {
      await invoke(admin, cure, 'lift', { src: addr });
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/not-authorized`);
    }
  });

  xit('test fail del source auth', async () => {
    const { address: addr } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr });
    await invoke(admin, cure, 'deny', { usr: _admin });
    try {
      await invoke(admin, cure, 'drop', { src: addr });
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/not-authorized`);
    }
  });

  // function testDelSourceNonExisting() public {
  it('test fail del source non existing', async () => {
    // address addr1 = address(new SourceMock(0));
    const { address: addr1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    // cure.lift(addr1);
    await invoke(admin, cure, 'lift', { src: addr1 });
    // address addr2 = address(new SourceMock(0));

    const { address: addr2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    try {
      // vm.expectRevert("Cure/non-existing-source");
      // cure.drop(addr2);
      await invoke(admin, cure, 'drop', { src: addr2 });
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/non-existing-source`);
    }
  });

  // function testCage() public {
  it('test cage', async () => {
    // assertEq(cure.live(), 1);
    expect((await cure.call('live')).res).to.equal(1n);
    // vm.expectEmit(true, true, true, true);
    // emit Cage();
    // cure.cage();
    await invoke(admin, cure, 'cage');
    // assertEq(cure.live(), 0);

    expect((await cure.call('live')).res).to.equal(0n);
  });

  // function testCure() public {
  it('test cure', async () => {
    // address source1 = address(new SourceMock(15_000));
    // address source2 = address(new SourceMock(30_000));
    // address source3 = address(new SourceMock(50_000));
    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(15000n).res,
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(30000n).res,
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(50000n).res,
      },
      hre
    );
    // cure.lift(source1);
    // cure.lift(source2);
    // cure.lift(source3);
    await invoke(admin, cure, 'lift', { src: source1 });
    await invoke(admin, cure, 'lift', { src: source2 });
    await invoke(admin, cure, 'lift', { src: source3 });
    // cure.cage();
    await invoke(admin, cure, 'cage');
    // cure.load(source1);
    // assertEq(cure.say(), 15_000);
    // assertEq(cure.tell(), 15_000); // It doesn't fail as wait == 0
    await invoke(admin, cure, 'load', { src: source1 });
    expect((await cure.call('say')).res).to.deep.equal(l2Eth(15000n).res);
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(15000n).res);
    // cure.load(source2);
    // assertEq(cure.say(), 45_000);
    // assertEq(cure.tell(), 45_000);
    await invoke(admin, cure, 'load', { src: source2 });
    expect((await cure.call('say')).res).to.deep.equal(l2Eth(45000n).res);
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(45000n).res);
    // cure.load(source3);
    // assertEq(cure.say(), 95_000);
    // assertEq(cure.tell(), 95_000);
    await invoke(admin, cure, 'load', { src: source3 });
    expect((await cure.call('say')).res).to.deep.equal(l2Eth(95000n).res);
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(95000n).res);
  });

  // function testCureAllLoaded() public {
  it('test cure all loaded', async () => {
    // address source1 = address(new SourceMock(15_000));
    // address source2 = address(new SourceMock(30_000));
    // address source3 = address(new SourceMock(50_000));
    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(15000n).res,
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(30000n).res,
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(50000n).res,
      },
      hre
    );
    // cure.lift(source1);
    // assertEq(cure.tCount(), 1);
    await invoke(admin, cure, 'lift', { src: source1 });
    expect((await cure.call('tCount')).res).to.equal(1n);
    // cure.lift(source2);
    // assertEq(cure.tCount(), 2);
    await invoke(admin, cure, 'lift', { src: source2 });
    expect((await cure.call('tCount')).res).to.equal(2n);
    // cure.lift(source3);
    // assertEq(cure.tCount(), 3);
    await invoke(admin, cure, 'lift', { src: source3 });
    expect((await cure.call('tCount')).res).to.equal(3n);
    // cure.file('wait', 10);
    await invoke(admin, cure, 'file', {
      what: l2String('wait'),
      data: 10n,
    });
    // cure.cage();
    await invoke(admin, cure, 'cage');
    // cure.load(source1);
    // assertEq(cure.lCount(), 1);
    // assertEq(cure.say(), 15_000);
    await invoke(admin, cure, 'load', { src: source1 });
    expect((await cure.call('say')).res).to.deep.equal(l2Eth(15000n).res);
    expect((await cure.call('lCount')).res).to.equal(1n);
    // cure.load(source2);
    // assertEq(cure.lCount(), 2);
    // assertEq(cure.say(), 45_000);
    await invoke(admin, cure, 'load', { src: source2 });
    expect((await cure.call('say')).res).to.deep.equal(l2Eth(45000n).res);
    expect((await cure.call('lCount')).res).to.equal(2n);
    // cure.load(source3);
    // assertEq(cure.lCount(), 3);
    // assertEq(cure.say(), 95_000);
    // assertEq(cure.tell(), 95_000);
    await invoke(admin, cure, 'load', { src: source3 });
    expect((await cure.call('lCount')).res).to.equal(3n);
    expect((await cure.call('say')).res).to.deep.equal(l2Eth(95000n).res);
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(95000n).res);
  });

  // function testCureWaitPassed() public {
  it('test cure wait passed', async () => {
    // address source1 = address(new SourceMock(15_000));
    // address source2 = address(new SourceMock(30_000));
    // address source3 = address(new SourceMock(50_000));
    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(15000n).res,
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(30000n).res,
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(50000n).res,
      },
      hre
    );
    // cure.lift(source1);
    // cure.lift(source2);
    // cure.lift(source3);
    await invoke(admin, cure, 'lift', { src: source1 });
    await invoke(admin, cure, 'lift', { src: source2 });
    await invoke(admin, cure, 'lift', { src: source3 });
    // cure.file("wait", 10);
    await invoke(admin, cure, 'file', {
      what: l2String('wait'),
      data: 10n,
    });
    // cure.cage();
    await invoke(admin, cure, 'cage');
    // cure.load(source1);
    // cure.load(source2);
    await invoke(admin, cure, 'load', { src: source1 });
    await invoke(admin, cure, 'load', { src: source2 });
    // vm.warp(block.timestamp + 10);
    // assertEq(cure.tell(), 45_000);
    await starknet.devnet.increaseTime(10);
    await starknet.devnet.createBlock();
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(45000n).res);
  });

  // function testWaitNotPassed() public {
  it('test wait not passed', async () => {
    // address source1 = address(new SourceMock(15_000));
    // address source2 = address(new SourceMock(30_000));
    // address source3 = address(new SourceMock(50_000));

    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(15000n).res,
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(30000n).res,
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(50000n).res,
      },
      hre
    );
    // cure.lift(source1);
    // cure.lift(source2);
    // cure.lift(source3);
    await invoke(admin, cure, 'lift', { src: source1 });
    await invoke(admin, cure, 'lift', { src: source2 });
    await invoke(admin, cure, 'lift', { src: source3 });
    // cure.file('wait', 10);
    await invoke(admin, cure, 'file', {
      what: l2String('wait'),
      data: 10n,
    });
    // cure.cage();
    await invoke(admin, cure, 'cage');
    // cure.load(source1);
    // cure.load(source2);
    await invoke(admin, cure, 'load', { src: source1 });
    await invoke(admin, cure, 'load', { src: source2 });
    // vm.warp(block.timestamp + 9);
    await starknet.devnet.increaseTime(9);
    await starknet.devnet.createBlock();
    try {
      // vm.expectRevert('Cure/missing-load-and-time-not-passed');
      // cure.tell();
      await cure.call('tell');
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/missing-load-and-time-not-passed`);
    }
  });

  // function testLoadMultipleTimes() public {
  it('test load multiple times', async () => {
    // address source1 = address(new SourceMock(2_000));
    // address source2 = address(new SourceMock(3_000));
    const source1 = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(2000n).res,
      },
      hre
    );
    const source2 = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(3000n).res,
      },
      hre
    );
    // cure.lift(source1);
    // cure.lift(source2);
    await invoke(admin, cure, 'lift', { src: source1.address });
    await invoke(admin, cure, 'lift', { src: source2.address });
    // cure.cage();
    await invoke(admin, cure, 'cage');
    // vm.expectEmit(true, true, true, true);
    // emit Load(source1);
    // cure.load(source1);
    // assertEq(cure.lCount(), 1);
    // cure.load(source2);
    // assertEq(cure.lCount(), 2);
    // assertEq(cure.tell(), 5_000);
    await invoke(admin, cure, 'load', { src: source1.address });
    expect((await cure.call('lCount')).res).to.equal(1n);
    await invoke(admin, cure, 'load', { src: source2.address });
    expect((await cure.call('lCount')).res).to.equal(2n);
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(5000n).res);
    // SourceMock(source1).update(4_000);
    // assertEq(cure.tell(), 5_000);
    await invoke(admin, source1, 'update', {
      cure_: l2Eth(4000n).res,
    });
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(5000n).res);
    // cure.load(source1);
    // assertEq(cure.lCount(), 2);
    // assertEq(cure.tell(), 7_000);
    await invoke(admin, cure, 'load', { src: source1.address });
    expect((await cure.call('lCount')).res).to.equal(2n);
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(7000n).res);
    // SourceMock(source2).update(6_000);
    // assertEq(cure.tell(), 7_000);
    await invoke(admin, source2, 'update', {
      cure_: l2Eth(6000n).res,
    });
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(7000n).res);
    // cure.load(source2);
    // assertEq(cure.lCount(), 2);
    // assertEq(cure.tell(), 10_000);
    await invoke(admin, cure, 'load', { src: source2.address });
    expect((await cure.call('lCount')).res).to.equal(2n);
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(10000n).res);
  });

  // function testLoadNoChange() public {
  it('test load no change', async () => {
    // address source = address(new SourceMock(2_000));
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(2000n).res,
      },
      hre
    );
    // cure.lift(source);
    await invoke(admin, cure, 'lift', { src: source });
    // cure.cage();
    await invoke(admin, cure, 'cage');
    // cure.load(source);
    // assertEq(cure.tell(), 2_000);
    await invoke(admin, cure, 'load', { src: source });
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(2000n).res);
    // cure.load(source);
    // assertEq(cure.tell(), 2_000);
    await invoke(admin, cure, 'load', { src: source });
    expect((await cure.call('tell')).res).to.deep.equal(l2Eth(2000n).res);
  });

  // function testLoadNotCaged() public {
  it('test load not caged', async () => {
    // address source = address(new SourceMock(2_000));
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(2000n).res,
      },
      hre
    );
    // cure.lift(source);
    await invoke(admin, cure, 'lift', { src: source });

    try {
      // vm.expectRevert('Cure/still-live');
      // cure.load(source);
      await invoke(admin, cure, 'load', { src: source });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/still-live');
    }
  });

  it('test fail load not added', async () => {
    // address source = address(new SourceMock(2_000));
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(2000n).res,
      },
      hre
    );
    // cure.cage();
    await invoke(admin, cure, 'cage');
    try {
      // vm.expectRevert("Cure/non-existing-source");
      // cure.load(source);
      await invoke(admin, cure, 'load', { src: source });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/non-existing-source');
    }
  });

  xit('test fail caged rely', async () => {
    await invoke(admin, cure, 'cage');
    try {
      await invoke(admin, cure, 'rely', { usr: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/not-live');
    }
  });

  xit('test fail caged deny', async () => {
    await invoke(admin, cure, 'cage');

    try {
      await invoke(admin, cure, 'deny', { usr: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/not-live');
    }
  });

  xit('test fail caged add source', async () => {
    await invoke(admin, cure, 'cage');

    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );

    try {
      await invoke(admin, cure, 'lift', { src: source });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/not-live');
    }
  });

  xit('test fail caged del source', async () => {
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: source });

    await invoke(admin, cure, 'cage');

    try {
      await invoke(admin, cure, 'drop', { src: source });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/not-live');
    }
  });
});
