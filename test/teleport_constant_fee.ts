import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { HttpNetworkConfig } from 'hardhat/types';

import { asDec, eth, l2Eth, simpleDeployL2, SplitUint, toBytes32, l2String } from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = '9379074284324409537785911406195';
const TEST_ADDRESS = '9379074284324409537785911406195';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

const zero_uint = { low: 0n, high: 0n };

const fee = eth('0.01');
const ttl = 60 * 60 * 24 * 8; // 8 days

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('teleport constant fee', async function () {
  this.timeout(900_000);
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let teleportConstantFee: any;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;

    teleportConstantFee = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: { low: l2Eth(fee).toDec()[0], high: l2Eth(fee).toDec()[1] },
        ttl_: ttl,
      },
      hre
    );

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('unittest-dump.dmp');
  });

  it('test constructor', async () => {
    expect((await teleportConstantFee.call('fee')).fee).to.deep.equal(l2Eth(fee).res);
    expect((await teleportConstantFee.call('ttl')).ttl).to.equal(BigInt(ttl));
  });

  it('test fee for zero amount', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: toBytes32(TEST_ADDRESS),
      operator: toBytes32(_admin),
      amount: { low: 0, high: 0 },
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect(
      (
        await teleportConstantFee.call('getFee', {
          guid,
          line: zero_uint,
          debt: zero_uint,
          pending: zero_uint,
          amtToTake: { low: l2Eth(eth('10')).toDec()[0], high: l2Eth(eth('10')).toDec()[1] },
        })
      ).fees
    ).to.deep.equal(zero_uint);
  });
});
