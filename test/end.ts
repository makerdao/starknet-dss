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

describe('end', async function () {
  this.timeout(900_000);
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let end: any;
  let vat: any;
  let vow: any;
  let claimToken: any;

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

    claimToken = await simpleDeployL2('mock_token', { ward: _admin }, hre);

    vow = await simpleDeployL2(
      'mock_vow',
      {
        vat_: vat.starknetContract.address,
      },
      hre
    );

    end = await simpleDeployL2(
      'end',
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

  it('test rely deny', async () => {
    await checkAuth(end, 'End');
  });
});
