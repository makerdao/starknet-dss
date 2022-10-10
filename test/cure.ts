import { Account, StarknetContract } from 'hardhat/types';
import { expect } from 'chai';
import hre, { starknet } from 'hardhat';

import { l2Eth, simpleDeployL2, SplitUint, l2String, l2Address, invoke } from './utils';

const TEST_ADDRESS = '9379074284324409537785911406195';

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('cure', async function () {
  this.timeout(900_000);
  let admin: Account;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let cure: StarknetContract;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;
    cure = await simpleDeployL2(
      'cure',
      {
        ward: _admin,
      },
      hre
    );

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('unittest-dump.dmp');
  });

  async function checkAuth(base: any, contractName: string) {
    const { res: ward } = await base.call('wards', { user: _admin });

    // await GodMode.setWard(base.address, this, 1);

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await invoke(admin, base, 'rely', { user: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(1n);

    await invoke(admin, base, 'deny', { user: TEST_ADDRESS });

    expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

    await invoke(admin, base, 'deny', { user: _admin });

    try {
      await invoke(admin, base, 'rely', { user: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }
    try {
      await invoke(admin, base, 'deny', { user: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain(`${contractName}/not-authorized`);
    }

    // await GodMode.setWard(base.address, this, ward);
  }

  it('test rely deny', async () => {
    await checkAuth(cure, 'Cure');
  });

  // it('test file', async () => {
  //   await checkFileFelt(cure, 'Cure', ['wait']);
  // });

  it('test add source del source', async () => {
    expect((await cure.call('tCount')).count_).to.equal(0n);
    const { address: addr1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: l2Eth(0n).res,
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr1 });
    expect((await cure.call('tCount')).count_).to.equal(1n);

    const { address: addr2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr2 });
    expect((await cure.call('tCount')).count_).to.equal(2n);

    const { address: addr3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr3 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(3n);

    await invoke(admin, cure, 'drop', { src: addr3 });
    expect((await cure.call('tCount')).count_).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);

    await invoke(admin, cure, 'lift', { src: addr3 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(3n);

    await invoke(admin, cure, 'drop', { src: addr1 });
    expect((await cure.call('tCount')).count_).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);

    await invoke(admin, cure, 'lift', { src: addr1 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(3n);

    const { address: addr4 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr4 });
    expect((await cure.call('tCount')).count_).to.equal(4n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(3n);
    expect(l2Address((await cure.call('srcs', { index: 3n })).src)).to.equal(addr4);
    expect((await cure.call('pos', { src: addr4 })).pos).to.equal(4n);

    await invoke(admin, cure, 'drop', { src: addr2 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr4);
    expect((await cure.call('pos', { src: addr4 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(3n);
  });

  it('test fail add source auth', async () => {
    await invoke(admin, cure, 'deny', { user: _admin });
    const { address: addr } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    try {
      await invoke(admin, cure, 'lift', { src: addr });
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/not-authorized`);
    }
  });

  it('test fail del source auth', async () => {
    const { address: addr } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr });
    await invoke(admin, cure, 'deny', { user: _admin });
    try {
      await invoke(admin, cure, 'drop', { src: addr });
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/not-authorized`);
    }
  });

  it('test fail del source non existing', async () => {
    const { address: addr1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: addr1 });

    const { address: addr2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    try {
      await invoke(admin, cure, 'drop', { src: addr2 });
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/non-existing-source`);
    }
  });

  it('test cage', async () => {
    expect((await cure.call('live')).live).to.equal(1n);
    await invoke(admin, cure, 'cage');
    expect((await cure.call('live')).live).to.equal(0n);
  });

  it('test cure', async () => {
    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(15000n).toDec()[0],
          high: l2Eth(15000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(30000n).toDec()[0],
          high: l2Eth(30000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(50000n).toDec()[0],
          high: l2Eth(50000n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: source1 });
    await invoke(admin, cure, 'lift', { src: source2 });
    await invoke(admin, cure, 'lift', { src: source3 });

    await invoke(admin, cure, 'cage');

    await invoke(admin, cure, 'load', { src: source1 });
    expect((await cure.call('say')).say).to.deep.equal(l2Eth(15000n).res);
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(15000n).res);
    await invoke(admin, cure, 'load', { src: source2 });
    expect((await cure.call('say')).say).to.deep.equal(l2Eth(45000n).res);
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(45000n).res);
    await invoke(admin, cure, 'load', { src: source3 });
    expect((await cure.call('say')).say).to.deep.equal(l2Eth(95000n).res);
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(95000n).res);
  });

  it('test cure all loaded', async () => {
    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(15000n).toDec()[0],
          high: l2Eth(15000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(30000n).toDec()[0],
          high: l2Eth(30000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(50000n).toDec()[0],
          high: l2Eth(50000n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: source1 });
    expect((await cure.call('tCount')).count_).to.equal(1n);

    await invoke(admin, cure, 'lift', { src: source2 });
    expect((await cure.call('tCount')).count_).to.equal(2n);

    await invoke(admin, cure, 'lift', { src: source3 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    await invoke(admin, cure, 'file', {
      what: l2String('wait'),
      data: { low: l2Eth(10n).toDec()[0], high: l2Eth(10n).toDec()[1] },
    });

    await invoke(admin, cure, 'cage');

    await invoke(admin, cure, 'load', { src: source1 });
    expect((await cure.call('say')).say).to.deep.equal(l2Eth(15000n).res);
    expect((await cure.call('lCount')).count_).to.equal(1n);
    await invoke(admin, cure, 'load', { src: source2 });
    expect((await cure.call('say')).say).to.deep.equal(l2Eth(45000n).res);
    expect((await cure.call('lCount')).count_).to.equal(2n);
    await invoke(admin, cure, 'load', { src: source3 });
    expect((await cure.call('lCount')).count_).to.equal(3n);
    expect((await cure.call('say')).say).to.deep.equal(l2Eth(95000n).res);
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(95000n).res);
  });

  it('test cure wait passed', async () => {
    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(15000n).toDec()[0],
          high: l2Eth(15000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(30000n).toDec()[0],
          high: l2Eth(30000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(50000n).toDec()[0],
          high: l2Eth(50000n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: source1 });
    await invoke(admin, cure, 'lift', { src: source2 });
    await invoke(admin, cure, 'lift', { src: source3 });

    await invoke(admin, cure, 'file', {
      what: l2String('wait'),
      data: { low: l2Eth(10n).toDec()[0], high: l2Eth(10n).toDec()[1] },
    });

    await invoke(admin, cure, 'cage');

    await invoke(admin, cure, 'load', { src: source1 });
    await invoke(admin, cure, 'load', { src: source2 });

    await starknet.devnet.increaseTime(10);
    await starknet.devnet.createBlock();
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(45000n).res);
  });

  it('test fail wait', async () => {
    const { address: source1 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(15000n).toDec()[0],
          high: l2Eth(15000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source2 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(30000n).toDec()[0],
          high: l2Eth(30000n).toDec()[1],
        },
      },
      hre
    );
    const { address: source3 } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(50000n).toDec()[0],
          high: l2Eth(50000n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: source1 });
    await invoke(admin, cure, 'lift', { src: source2 });
    await invoke(admin, cure, 'lift', { src: source3 });

    await invoke(admin, cure, 'file', {
      what: l2String('wait'),
      data: { low: l2Eth(10n).toDec()[0], high: l2Eth(10n).toDec()[1] },
    });

    await invoke(admin, cure, 'cage');

    await invoke(admin, cure, 'load', { src: source1 });
    await invoke(admin, cure, 'load', { src: source2 });

    await starknet.devnet.increaseTime(9);
    await starknet.devnet.createBlock();
    try {
      await cure.call('tell');
    } catch (err: any) {
      expect(err.message).to.contain(`Cure/missing-load-and-time-not-passed`);
    }
  });

  it('test load multiple times', async () => {
    const source1 = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(2000n).toDec()[0],
          high: l2Eth(2000n).toDec()[1],
        },
      },
      hre
    );
    const source2 = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(3000n).toDec()[0],
          high: l2Eth(3000n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: source1.address });
    await invoke(admin, cure, 'lift', { src: source2.address });

    await invoke(admin, cure, 'cage');

    await invoke(admin, cure, 'load', { src: source1.address });
    expect((await cure.call('lCount')).count_).to.equal(1n);
    await invoke(admin, cure, 'load', { src: source2.address });
    expect((await cure.call('lCount')).count_).to.equal(2n);
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(5000n).res);

    await invoke(admin, source1, 'update', {
      cure_: { low: l2Eth(4000n).toDec()[0], high: l2Eth(4000n).toDec()[1] },
    });
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(5000n).res);

    await invoke(admin, cure, 'load', { src: source1.address });
    expect((await cure.call('lCount')).count_).to.equal(2n);
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(7000n).res);

    await invoke(admin, source2, 'update', {
      cure_: { low: l2Eth(6000n).toDec()[0], high: l2Eth(4000n).toDec()[1] },
    });
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(7000n).res);

    await invoke(admin, cure, 'load', { src: source2.address });
    expect((await cure.call('lCount')).count_).to.equal(2n);
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(10000n).res);
  });

  it('test load no change', async () => {
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(2000n).toDec()[0],
          high: l2Eth(2000n).toDec()[1],
        },
      },
      hre
    );

    await invoke(admin, cure, 'lift', { src: source });

    await invoke(admin, cure, 'cage');

    await invoke(admin, cure, 'load', { src: source });
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(2000n).res);

    await invoke(admin, cure, 'load', { src: source });
    expect((await cure.call('tell')).say).to.deep.equal(l2Eth(2000n).res);
  });

  it('test fail load not caged', async () => {
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(2000n).toDec()[0],
          high: l2Eth(2000n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'lift', { src: source });

    try {
      await invoke(admin, cure, 'load', { src: source });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/still-live');
    }
  });

  it('test fail load not added', async () => {
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(2000n).toDec()[0],
          high: l2Eth(2000n).toDec()[1],
        },
      },
      hre
    );
    await invoke(admin, cure, 'cage');
    try {
      await invoke(admin, cure, 'load', { src: source });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/non-existing-source');
    }
  });

  it('test fail caged rely', async () => {
    await invoke(admin, cure, 'cage');

    try {
      await invoke(admin, cure, 'rely', { user: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/not-live');
    }
  });

  it('test fail caged deny', async () => {
    await invoke(admin, cure, 'cage');

    try {
      await invoke(admin, cure, 'deny', { user: TEST_ADDRESS });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/not-live');
    }
  });

  it('test fail caged add source', async () => {
    await invoke(admin, cure, 'cage');

    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );

    try {
      await invoke(admin, cure, 'lift', { src: source });
    } catch (err: any) {
      expect(err.message).to.contain('Cure/not-live');
    }
  });

  it('test fail caged del source', async () => {
    const { address: source } = await simpleDeployL2(
      'mock_source',
      {
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
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
