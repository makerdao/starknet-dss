import { Account } from '@shardlabs/starknet-hardhat-plugin/dist/src/account';
import { StarknetContract } from '@shardlabs/starknet-hardhat-plugin/dist/src/types';
import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { HttpNetworkConfig } from 'hardhat/types';
import { KeyPair, Signer, validateAndParseAddress } from 'starknet';
import { getKeyPair, getStarkKey, sign } from 'starknet/dist/utils/ellipticCurve';
import { pedersen } from 'starknet/dist/utils/hash';
import { BigNumberish, toBN, toFelt } from 'starknet/utils/number';

import {
  asDec,
  eth,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  toBytes32,
  l2String,
  invoke,
  SplitUintType,
} from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = l2String('ethereum');
const TEST_ADDRESS = '9379074284324409537785911406195';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

const zero_uint = { low: 0n, high: 0n };

const fee = eth('0.01');
const ttl = 60 * 60 * 24 * 8; // 8 days

type TeleportGUID = {
  source_domain: string;
  target_domain: string;
  receiver: string;
  operator: string;
  amount: SplitUintType<bigint>;
  nonce: number;
  timestamp: number;
};

type Signature = {
  pk: string;
  r: BigNumberish;
  s: BigNumberish;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('teleport oracle auth', async function () {
  this.timeout(900_000);
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let auth: StarknetContract;
  let teleportJoin: string;

  before(async () => {
    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;

    teleportJoin = (await simpleDeployL2('mock_gateway', {}, hre)).address;
    auth = await simpleDeployL2(
      'teleport_oracle_auth',
      {
        ward: _admin,
        teleport_join_: teleportJoin,
      },
      hre
    );

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('unittest-dump.dmp');
  });

  function getGUIDHash(guid: TeleportGUID): string {
    let hash1 = pedersen([guid.timestamp.toString(), guid.nonce.toString()]);
    let hash2 = pedersen([hash1, guid.amount.low.toString()]);
    let hash3 = pedersen([hash2, guid.amount.high.toString()]);
    let hash4 = pedersen([hash3, guid.operator]);
    let hash5 = pedersen([hash4, guid.receiver]);
    let hash6 = pedersen([hash5, guid.target_domain]);
    let hash = pedersen([hash6, guid.source_domain]);
    return hash;
  }

  async function _tryRely(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, auth, 'rely', { usr });
      return Promise.resolve(true);
    } catch (error) {
      // console.error(error);
      return Promise.resolve(false);
    }
  }

  async function _tryDeny(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, auth, 'deny', { usr });
      return Promise.resolve(true);
    } catch (error) {
      // console.error(error);
      return Promise.resolve(false);
    }
  }

  async function _tryFile(what: string, data: any, domain?: any): Promise<boolean> {
    try {
      const what_ = l2String(what);
      await invoke(admin, auth, 'file', { what: what_, data });

      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  async function getSignatures(
    signHash: string
  ): Promise<{ signatures: Signature[]; signers: string[] }> {
    const seeds = [
      8, 10, 6, 2, 9, 15, 14, 20, 7, 29, 24, 13, 12, 25, 16, 26, 21, 22, 0, 18, 17, 27, 3, 28, 23,
      19, 4, 5, 1, 11,
    ];
    const numSigners = seeds.length;
    const signers: string[] = new Array(numSigners);
    const signatures: Signature[] = [];
    for (let index = 0; index < numSigners; index++) {
      const sk = pedersen([seeds[index], 0]);
      const _keyPair: KeyPair = getKeyPair(sk);
      const _pk = getStarkKey(_keyPair);
      signers[index] = toFelt(_pk);
      const _signature = sign(_keyPair, signHash);
      signatures.push({ pk: toFelt(_pk), r: _signature[0], s: _signature[1] } as Signature);
    }
    expect(signatures.length).to.be.equal(numSigners);
    return Promise.resolve({ signatures, signers });
  }

  async function requestMint(
    guid: TeleportGUID,
    signatures: Signature[],
    maxFeePercentage: number | string | bigint,
    operatorFee: number | string | bigint
  ) {
    // const { post_fee_amount: daiSent, total_fee: totalFees } = await join.call('requestMint', {
    //   teleportGUID: guid,
    //   max_fee_percentage: l2Eth(maxFeePercentage).res,
    //   operator_fee: l2Eth(operatorFee).res,
    // });
    const tx = await invoke(admin, auth, 'request_mint', {
      teleport_GUID: guid,
      signatures,
      max_fee_percentage: l2Eth(maxFeePercentage).res,
      operator_fee: l2Eth(operatorFee).res,
    });
    // console.log(daiSent);
    const receipt = await starknet.getTransactionReceipt(tx);
    // const decodedEvents = await dai.decodeEvents(receipt.events);
    // console.log(receipt);
    return [0, 0];
  }

  it('test constructor', async () => {
    expect((await auth.call('teleport_join')).res).to.be.equal(BigInt(teleportJoin));
    expect((await auth.call('wards', { usr: _admin })).res).to.be.equal(1n);
  });

  it('test rely deny', async () => {
    expect((await auth.call('wards', { usr: TEST_ADDRESS })).res).to.be.equal(0n);
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.true;
    expect((await auth.call('wards', { usr: TEST_ADDRESS })).res).to.be.equal(1n);
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.true;
    expect((await auth.call('wards', { usr: TEST_ADDRESS })).res).to.be.equal(0n);

    await invoke(admin, auth, 'deny', { usr: _admin });
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.false;
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.false;
  });

  it('test file fails when not authed', async () => {
    expect(await _tryFile('threshold', 888)).to.be.true;
    await invoke(admin, auth, 'deny', { usr: _admin });
    expect(await _tryFile('threshold', 888)).to.be.false;
  });

  it('test fail file invalid what', async () => {
    expect(await _tryFile('meh', 888)).to.be.false;
  });

  it('test add remove signers', async () => {
    let signers = [];
    for (let index = 0; index < 3; index++) {
      let _address = toFelt(validateAndParseAddress(index));
      signers[index] = _address;
      expect((await auth.call('signers', { address: _address })).res).to.be.equal(0n);
    }
    await invoke(admin, auth, 'add_signers', { signers_: signers });

    for (let index = 0; index < 3; index++) {
      let _address = toFelt(validateAndParseAddress(index));
      expect((await auth.call('signers', { address: _address })).res).to.be.equal(1n);
    }

    await invoke(admin, auth, 'remove_signers', { signers_: signers });

    for (let index = 0; index < 3; index++) {
      let _address = toFelt(validateAndParseAddress(index));
      expect((await auth.call('signers', { address: _address })).res).to.be.equal(0n);
    }
  });

  it('test validate', async () => {
    const signHash = pedersen([l2String('msg'), 0]);
    const { signatures, signers } = await getSignatures(signHash);
    await invoke(admin, auth, 'add_signers', { signers_: signers });
    await auth.call('validate', {
      message: signHash,
      signatures,
      threshold_: signers.length,
      previous: 0,
    });
  });

  // Since ecrecover silently returns 0 on failure, it's a good idea to make sure
  // the logic can't be fooled by a zero signer address + invalid signature.
  it('test fail validate failed ecrecover', async () => {
    const signHash = pedersen([l2String('msg'), 0]);
    const { signatures, signers } = await getSignatures(signHash);

    // corrupt 1st signature
    const _r = toBN(signatures[0].r).add(toBN(1));
    signatures[0].r = _r.toString();
    // 1st signer to zero
    signers[0] = '0';

    await invoke(admin, auth, 'add_signers', { signers_: signers });
    await auth.call('validate', {
      message: signHash,
      signatures,
      threshold_: signers.length,
      previous: 0,
    });
  });

  it('test fail validate not enough sig', async () => {
    const signHash = pedersen([l2String('msg'), 0]);
    const { signatures, signers } = await getSignatures(signHash);

    await invoke(admin, auth, 'add_signers', { signers_: signers });
    await auth.call('validate', {
      message: signHash,
      signatures,
      threshold_: signers.length + 1,
      previous: 0,
    });
  });

  it('test fail validate bad sig', async () => {
    const signHash = pedersen([l2String('msg'), 0]);
    const { signatures, signers } = await getSignatures(signHash);

    await invoke(admin, auth, 'add_signers', { signers_: signers });

    // corrupt 1st signature
    const _r = toBN(signatures[0].r).add(toBN(1));
    signatures[0].r = _r.toString();

    await auth.call('validate', {
      message: signHash,
      signatures,
      threshold_: signers.length + 1,
      previous: 0,
    });
  });

  it('test mint by operator', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: _admin,
      amount: l2Eth(100).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    const signHash = getGUIDHash(guid);
    const { signatures, signers } = await getSignatures(signHash);

    await invoke(admin, auth, 'add_signers', { signers_: signers });

    const maxFee = 0;

    await requestMint(guid, signatures, maxFee, 0);
  });

  it('test mint by operator not receiver', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(100).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    const signHash = getGUIDHash(guid);
    const { signatures, signers } = await getSignatures(signHash);

    await invoke(admin, auth, 'add_signers', { signers_: signers });

    const maxFee = 0;

    await requestMint(guid, signatures, maxFee, 0);
  });

  it('test mint by receiver', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: '0',
      amount: l2Eth(100).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    const signHash = getGUIDHash(guid);
    const { signatures, signers } = await getSignatures(signHash);

    await invoke(admin, auth, 'add_signers', { signers_: signers });

    const maxFee = 0;

    await requestMint(guid, signatures, maxFee, 0);
  });

  it('test fail mint not operator nor receiver', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324441537125931966192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(100).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    const signHash = getGUIDHash(guid);
    const { signatures, signers } = await getSignatures(signHash);

    await invoke(admin, auth, 'add_signers', { signers_: signers });

    const maxFee = 0;

    try {
      await requestMint(guid, signatures, maxFee, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportOracleAuth/not-receiver-nor-operator');
    }
  });
});
