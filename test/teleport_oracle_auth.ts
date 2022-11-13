import { Account } from '@shardlabs/starknet-hardhat-plugin/dist/src/account';
import { StarknetContract } from '@shardlabs/starknet-hardhat-plugin/dist/src/types';
import { expect } from 'chai';
import hre, { starknet } from 'hardhat';
import { KeyPair, validateAndParseAddress } from 'starknet';
import { getKeyPair, getStarkKey, sign } from 'starknet/dist/utils/ellipticCurve';
import { pedersen } from 'starknet/dist/utils/hash';
import { BigNumberish, toBN, toFelt } from 'starknet/utils/number';

import { l2Eth, simpleDeployL2, l2String, invoke, SplitUintType } from './utils';

// Cairo encoding of "valid_domains"
const TEST_ADDRESS = '9379074284324409537785911406195';

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
    // seeds chosen s.t. corresponding addresses are in ascending order
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

  // function testConstructor() public {
  it('test constructor', async () => {
    // assertEq(address(auth.teleportJoin()), teleportJoin);
    expect((await auth.call('teleport_join')).res).to.be.equal(BigInt(teleportJoin));
    // assertEq(auth.wards(address(this)), 1);
    expect((await auth.call('wards', { usr: _admin })).res).to.be.equal(1n);
  });

  // function testRelyDeny() public {
  it('test rely deny', async () => {
    // assertEq(auth.wards(address(456)), 0);
    expect((await auth.call('wards', { usr: TEST_ADDRESS })).res).to.be.equal(0n);
    // assertTrue(_tryRely(address(456)));
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.true;
    // assertEq(auth.wards(address(456)), 1);
    expect((await auth.call('wards', { usr: TEST_ADDRESS })).res).to.be.equal(1n);
    // assertTrue(_tryDeny(address(456)));
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.true;
    // assertEq(auth.wards(address(456)), 0);
    expect((await auth.call('wards', { usr: TEST_ADDRESS })).res).to.be.equal(0n);

    // auth.deny(address(this));
    await invoke(admin, auth, 'deny', { usr: _admin });

    // assertTrue(!_tryRely(address(456)));
    // assertTrue(!_tryDeny(address(456)));
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.false;
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.false;
  });

  // function testFileFailsWhenNotAuthed() public {
  it('test file fails when not authed', async () => {
    // assertTrue(_tryFile('threshold', 888));
    expect(await _tryFile('threshold', 888)).to.be.true;
    // auth.deny(address(this));
    await invoke(admin, auth, 'deny', { usr: _admin });
    // assertTrue(!_tryFile('threshold', 888));
    expect(await _tryFile('threshold', 888)).to.be.false;
  });

  // function testFileNewThreshold() public {
  it('test file new treshold', async () => {
    // assertEq(auth.threshold(), 0);
    expect((await auth.call('threshold')).res).to.be.equal(0n);
    // assertTrue(_tryFile('threshold', 3));
    expect(await _tryFile('threshold', 3n)).to.be.true;
    // assertEq(auth.threshold(), 3);
    expect((await auth.call('threshold')).res).to.be.equal(3n);
  });

  // function testFailFileInvalidWhat() public {
  it('test fail file invalid what', async () => {
    // auth.file("meh", 888);
    expect(await _tryFile('meh', 888)).to.be.false;
  });

  // function testAddRemoveSigners() public {
  it('test add remove signers', async () => {
    // address[] memory signers = new address[](3);
    // for(uint i; i < signers.length; i++) {
    //     signers[i] = address(uint160(i));
    //     assertEq(auth.signers(address(uint160(i))), 0);
    // }
    let signers = [];
    for (let index = 0; index < 3; index++) {
      let _address = toFelt(validateAndParseAddress(index));
      signers[index] = _address;
      expect((await auth.call('signers', { address: _address })).res).to.be.equal(0n);
    }

    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });

    // for(uint i; i < signers.length; i++) {
    //     assertEq(auth.signers(address(uint160(i))), 1);
    // }
    for (let index = 0; index < 3; index++) {
      let _address = toFelt(validateAndParseAddress(index));
      expect((await auth.call('signers', { address: _address })).res).to.be.equal(1n);
    }

    // auth.removeSigners(signers);
    await invoke(admin, auth, 'remove_signers', { signers_: signers });

    // for(uint i; i < signers.length; i++) {
    //     assertEq(auth.signers(address(uint160(i))), 0);
    // }
    for (let index = 0; index < 3; index++) {
      let _address = toFelt(validateAndParseAddress(index));
      expect((await auth.call('signers', { address: _address })).res).to.be.equal(0n);
    }
  });

  // function test_isValid() public {
  it('test validate', async () => {
    // bytes32 signHash = keccak256("msg");
    // (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    // auth.addSigners(signers);
    // assertTrue(auth.isValid(signHash, signatures, signers.length));
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
  // function testFail_isValid_failed_ecrecover() public {
  it('test fail validate failed ecrecover', async () => {
    // bytes32 signHash = keccak256("msg");
    const signHash = pedersen([l2String('msg'), 0]);
    // (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    const { signatures, signers } = await getSignatures(signHash);

    // corrupt first signature
    // unchecked {  // don't care about overflow, just want to change the first byte
    //     signatures[0] = bytes1(uint8(signatures[0]) + uint8(1));
    // }
    const _r = toBN(signatures[0].r).add(toBN(1));
    signatures[0].r = _r.toString();

    // first signer to zero
    // signers[0] = address(0);
    signers[0] = '0';

    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });
    // assertTrue(auth.isValid(signHash, signatures, signers.length));
    try {
      await auth.call('validate', {
        message: signHash,
        signatures,
        threshold_: signers.length,
        previous: 0,
      });
    } catch (err: any) {
      expect(err.message).to.contain('TeleportOracleAuth/not-enough-signatures');
    }
  });

  // function testFail_isValid_notEnoughSig() public {
  it('test fail validate not enough sig', async () => {
    // bytes32 signHash = keccak256("msg");
    const signHash = pedersen([l2String('msg'), 0]);
    //  (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    const { signatures, signers } = await getSignatures(signHash);
    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });
    // assertTrue(auth.isValid(signHash, signatures, signers.length + 1));
    try {
      await auth.call('validate', {
        message: signHash,
        signatures,
        threshold_: signers.length + 1,
        previous: 0,
      });
    } catch (err: any) {
      expect(err.message).to.contain('TeleportOracleAuth/not-enough-signatures');
    }
  });

  // function testFail_isValid_badSig() public {
  it('test fail validate bad sig', async () => {
    //  bytes32 signHash = keccak256("msg");
    const signHash = pedersen([l2String('msg'), 0]);
    // (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    const { signatures, signers } = await getSignatures(signHash);
    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });

    // signatures[0] = bytes1(uint8((uint256(uint8(signatures[0])) + 1) % 256));
    const _r = toBN(signatures[0].r).add(toBN(1));
    signatures[0].r = _r.toString();

    // assertTrue(auth.isValid(signHash, signatures, signers.length));
    try {
      await auth.call('validate', {
        message: signHash,
        signatures,
        threshold_: signers.length + 1,
        previous: 0,
      });
    } catch (err: any) {
      expect(err.message).to.contain('TeleportOracleAuth/not-enough-signatures');
    }
  });

  // function test_mintByOperator() public {
  it('test mint by operator', async () => {
    // TeleportGUID memory guid;
    // guid.operator = addressToBytes32(address(this));
    // guid.sourceDomain = bytes32("l2network");
    // guid.targetDomain = bytes32("ethereum");
    // guid.receiver = addressToBytes32(address(this));
    // guid.amount = 100;
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: _admin,
      amount: l2Eth(100).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };
    // bytes32 signHash = auth.getSignHash(guid);
    const signHash = getGUIDHash(guid);
    // (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    const { signatures, signers } = await getSignatures(signHash);
    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });
    // uint maxFee = 0;
    const maxFee = 0;
    // auth.requestMint(guid, signatures, maxFee, 0);
    await requestMint(guid, signatures, maxFee, 0);
  });

  // function test_mintByOperatorNotReceiver() public {
  it('test mint by operator not receiver', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid;
    // guid.operator = addressToBytes32(address(this));
    // guid.sourceDomain = bytes32('l2network');
    // guid.targetDomain = bytes32('ethereum');
    // guid.receiver = addressToBytes32(address(0x123));
    // guid.amount = 100;
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(100).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    // bytes32 signHash = auth.getSignHash(guid);
    const signHash = getGUIDHash(guid);
    // (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    const { signatures, signers } = await getSignatures(signHash);
    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });
    // uint maxFee = 0;
    const maxFee = 0;
    // auth.requestMint(guid, signatures, maxFee, 0);
    await requestMint(guid, signatures, maxFee, 0);
  });

  // function test_mintByReceiver() public {
  it('test mint by receiver', async () => {
    // TeleportGUID memory guid;
    // guid.operator = addressToBytes32(address(0x000));
    // guid.sourceDomain = bytes32("l2network");
    // guid.targetDomain = bytes32("ethereum");
    // guid.receiver = addressToBytes32(address(this));
    // guid.amount = 100;
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: '0',
      amount: l2Eth(100).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };
    // bytes32 signHash = auth.getSignHash(guid);
    const signHash = getGUIDHash(guid);
    // (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    const { signatures, signers } = await getSignatures(signHash);
    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });
    // uint maxFee = 0;
    const maxFee = 0;
    // auth.requestMint(guid, signatures, maxFee, 0);
    await requestMint(guid, signatures, maxFee, 0);
  });

  // function testFail_mint_notOperatorNorReceiver() public {
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
    // TeleportGUID memory guid;
    // guid.operator = addressToBytes32(address(0x123));
    // guid.sourceDomain = bytes32('l2network');
    // guid.targetDomain = bytes32('ethereum');
    // guid.receiver = addressToBytes32(address(0x987));
    // guid.amount = 100;

    // bytes32 signHash = auth.getSignHash(guid);
    const signHash = getGUIDHash(guid);
    // (bytes memory signatures, address[] memory signers) = getSignatures(signHash);
    const { signatures, signers } = await getSignatures(signHash);
    // auth.addSigners(signers);
    await invoke(admin, auth, 'add_signers', { signers_: signers });
    // uint maxFee = 0;
    const maxFee = 0;

    try {
      // auth.requestMint(guid, signatures, maxFee, 0);
      await requestMint(guid, signatures, maxFee, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportOracleAuth/not-receiver-nor-operator');
    }
  });
});
