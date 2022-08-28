import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { HttpNetworkConfig } from 'hardhat/types';

import {
  asDec,
  eth,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  toBytes32,
  l2String,
  asHex,
  l2Address,
} from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = '9379074284324409537785911406195';

const ILK = l2String('SOME-ILK-A');

const TEST_ADDRESS = '9379074284324409537785911406195';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('cure', async function () {
  this.timeout(900_000);
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let cure: any;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
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

    await starknet.devnet.dump('dump.pkl');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('dump.pkl');
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

  async function checkFileFelt(base: any, contractName: string, values: string[]) {
    const { res: ward } = await base.call('wards', { user: _admin });

    // Ensure we have admin access
    // await GodMode.setWard(base, admin.address, 1);

    // First check an invalid value
    try {
      await admin.invoke(base, 'file', {
        what: l2String('an invalid value'),
        data: 1n,
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
    await admin.invoke(base, 'deny', { user: _admin });
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
        cure_: {
          low: l2Eth(0n).toDec()[0],
          high: l2Eth(0n).toDec()[1],
        },
      },
      hre
    );
    await admin.invoke(cure, 'lift', { src: addr1 });
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
    await admin.invoke(cure, 'lift', { src: addr2 });
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
    await admin.invoke(cure, 'lift', { src: addr3 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(3n);

    await admin.invoke(cure, 'drop', { src: addr3 });
    expect((await cure.call('tCount')).count_).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);

    await admin.invoke(cure, 'lift', { src: addr3 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(3n);

    await admin.invoke(cure, 'drop', { src: addr1 });
    expect((await cure.call('tCount')).count_).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);

    await admin.invoke(cure, 'lift', { src: addr1 });
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
    await admin.invoke(cure, 'lift', { src: addr4 });
    expect((await cure.call('tCount')).count_).to.equal(4n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr2);
    expect((await cure.call('pos', { src: addr2 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(3n);
    expect(l2Address((await cure.call('srcs', { index: 3n })).src)).to.equal(addr4);
    expect((await cure.call('pos', { src: addr4 })).pos).to.equal(4n);

    await admin.invoke(cure, 'drop', { src: addr2 });
    expect((await cure.call('tCount')).count_).to.equal(3n);

    expect(l2Address((await cure.call('srcs', { index: 0n })).src)).to.equal(addr3);
    expect((await cure.call('pos', { src: addr3 })).pos).to.equal(1n);
    expect(l2Address((await cure.call('srcs', { index: 1n })).src)).to.equal(addr4);
    expect((await cure.call('pos', { src: addr4 })).pos).to.equal(2n);
    expect(l2Address((await cure.call('srcs', { index: 2n })).src)).to.equal(addr1);
    expect((await cure.call('pos', { src: addr1 })).pos).to.equal(3n);
  });
});
