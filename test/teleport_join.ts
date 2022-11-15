import { expect } from 'chai';
import { writeFileSync } from 'fs';
// import { BigNumber } from 'ethers';
import hre, { starknet } from 'hardhat';
import { Account, StarknetContract } from 'hardhat/types';
import { pedersen } from 'starknet/dist/utils/hash';

import {
  eth,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  l2String,
  invoke,
  SplitUintType,
  adaptUrl,
  neg,
  uint,
} from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = l2String('ethereum');
const TEST_ADDRESS = '9379074284324409537785911406195';
const VOW_ADDRESS = '9379074284324409537785911406192';

const WAD = 10n ** 18n;
const RAD = 10n ** 45n;

const ILK = l2String('L2-DAI');

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

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('teleport join', async function () {
  this.timeout(900_000);
  let admin: Account;
  let _admin: string;
  let user1: Account;
  let _user1: string;
  let user2: Account;
  let _user2: any;
  let join: StarknetContract;
  let teleportRouter: StarknetContract;
  let vat: StarknetContract;
  let daiJoin: StarknetContract;
  let dai: StarknetContract;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;

    vat = await simpleDeployL2('mock_vat', {}, hre);

    dai = await simpleDeployL2(
      'mock_token',
      {
        ward: _admin,
      },
      hre
    );

    daiJoin = await simpleDeployL2(
      'mock_dai_join',
      {
        vat_: vat.address,
        dai_: dai.address,
      },
      hre
    );

    join = await simpleDeployL2(
      'teleport_join',
      {
        ward: _admin,
        vat_: vat.address,
        daiJoin_: daiJoin.address,
        ilk_: ILK,
        domain_: VALID_DOMAINS,
      },
      hre
    );

    const teleportConstantFee = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(0).res,
        ttl_: ttl,
      },
      hre
    );

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('1000000')).res,
    });
    await invoke(admin, join, 'file_vow', {
      what: l2String('vow'),
      data: VOW_ADDRESS,
    });
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: teleportConstantFee.address,
    });

    await invoke(admin, vat, 'hope', { usr: daiJoin.address });

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

  async function _ink() {
    const { urn: _urn } = await vat.call('urns', {
      i: (await join.call('ilk')).res,
      u: join.address,
    });
    return _urn['ink'];
  }

  async function _art() {
    const { urn: _urn } = await vat.call('urns', {
      i: (await join.call('ilk')).res,
      u: join.address,
    });
    return _urn['art'];
  }

  async function _blessed(guid: TeleportGUID) {
    const { res: _teleport } = await join.call('teleports', { hash: getGUIDHash(guid) });
    return _teleport['blessed'];
  }

  async function _pending(guid: TeleportGUID) {
    const { res: _teleport } = await join.call('teleports', { hash: getGUIDHash(guid) });
    return _teleport['pending'];
  }

  async function debt(domain: string) {
    return await join.call('debt', { d: domain });
  }

  async function _tryRely(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, join, 'rely', { usr });
      return Promise.resolve(true);
    } catch (error) {
      // console.error(error);
      return Promise.resolve(false);
    }
  }

  async function _tryDeny(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, join, 'deny', { usr });
      return Promise.resolve(true);
    } catch (error) {
      // console.error(error);
      return Promise.resolve(false);
    }
  }

  async function _tryFile(what: string, data: any, domain?: any): Promise<boolean> {
    try {
      const what_ = l2String(what);
      switch (what) {
        case 'vow':
          await invoke(admin, join, 'file_vow', { what: what_, data });
          break;
        case 'fees':
          await invoke(admin, join, 'file_fees', { what: what_, domain_: domain, data });
          break;
        case 'line':
          await invoke(admin, join, 'file_line', { what: what_, domain_: domain, data });
          break;
        default:
          return Promise.resolve(false);
      }
      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  async function suck(u: any, v: any, rad: SplitUintType<bigint>) {
    await invoke(admin, vat, 'suck', { u, v, rad });
  }

  async function settle(
    source_domain: string,
    target_domain: string,
    amount: SplitUintType<bigint>
  ) {
    await invoke(admin, join, 'settle', { source_domain, target_domain, amount });
  }

  async function requestMint(
    guid: TeleportGUID,
    maxFeePercentage: number | string | bigint,
    operatorFee: number | string | bigint
  ) {
    // const { post_fee_amount: daiSent, total_fee: totalFees } = await join.call('requestMint', {
    //   teleportGUID: guid,
    //   max_fee_percentage: l2Eth(maxFeePercentage).res,
    //   operator_fee: l2Eth(operatorFee).res,
    // });
    const txHash = await invoke(admin, join, 'requestMint', {
      teleportGUID: guid,
      max_fee_percentage: l2Eth(maxFeePercentage).res,
      operator_fee: l2Eth(operatorFee).res,
    });
    const hre: any = (starknet.devnet as any).hre;
    const options = {
      feederGatewayUrl: adaptUrl(hre.config.starknet.networkUrl),
      gatewayUrl: adaptUrl(hre.config.starknet.networkUrl),
      hash: txHash,
    };

    const preparedOptions = hre.starknetWrapper.prepareTxQueryOptions(
      'get_transaction_trace',
      options
    );
    const trace = await hre.starknetWrapper.execute('starknet', preparedOptions);
    // const selector = '0x1cf90c76feb7c5a66af63456f5cb56384c258c9ab40ebc62ac1f58f3b3a2fbd';
    const stdout = JSON.parse(trace['stdout']);
    const result = stdout['function_invocation']['internal_calls'][0]['result'].map((v: string) =>
      BigInt(v)
    );
    const postFeeAmount = { low: result[0], high: result[1] };
    const totalFee = { low: result[2], high: result[3] };
    return [totalFee, postFeeAmount];
  }

  async function mintPending(
    guid: TeleportGUID,
    maxFeePercentage: number | string | bigint,
    operatorFee: number | string | bigint
  ) {
    const [postFeeAmount, totalFee] = await invoke(admin, join, 'mintPending', {
      teleportGUID: guid,
      max_fee_percentage: l2Eth(maxFeePercentage).res,
      operator_fee: l2Eth(operatorFee).res,
    });
    return [postFeeAmount, totalFee];
  }

  // function testConstructor() public {
  it('test constructor', async () => {
    // assertEq(address(join.vat()), address(vat));
    // assertEq(address(join.daiJoin()), address(daiJoin));
    // assertEq(join.ilk(), ilk);
    // assertEq(join.domain(), domain);
    // assertEq(join.wards(address(this)), 1);
    expect((await join.call('vat')).res).to.equal(BigInt(vat.address));
    expect((await join.call('daiJoin')).res).to.equal(BigInt(daiJoin.address));
    expect((await join.call('ilk')).res).to.equal(BigInt(ILK));
    expect((await join.call('domain')).res).to.equal(BigInt(VALID_DOMAINS));
    expect((await join.call('wards', { user: _admin })).res).to.be.equal(1n);
  });

  // function testRelyDeny() public {
  it('test rely deny', async () => {
    // assertEq(join.wards(address(456)), 0);
    // assertTrue(_tryRely(address(456)));
    // assertEq(join.wards(address(456)), 1);
    // assertTrue(_tryDeny(address(456)));
    // assertEq(join.wards(address(456)), 0);
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.true;
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(1n);
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.true;
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);
    // join.deny(address(this));
    await invoke(admin, join, 'deny', { usr: _admin });
    // assertTrue(!_tryRely(address(456)));
    // assertTrue(!_tryDeny(address(456)));
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.false;
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.false;
  });

  // function testFile() public {
  it('test file', async () => {
    const TEST_FILE_ADDRESS = '9379024284324403537785931406192';
    // assertEq(join.vow(), vow);
    // assertTrue(_tryFile('vow', address(888)));
    // assertEq(join.vow(), address(888));
    expect((await join.call('vow')).res).to.equal(BigInt(VOW_ADDRESS));
    expect(await _tryFile('vow', TEST_FILE_ADDRESS)).to.be.true;
    expect((await join.call('vow')).res).to.equal(BigInt(TEST_FILE_ADDRESS));
    // assertEq(join.fees('aaa'), address(0));
    // assertTrue(_tryFile('fees', 'aaa', address(888)));
    // assertEq(join.fees('aaa'), address(888));
    expect((await join.call('fees', { d: l2String('aaa') })).res).to.equal(0n);
    expect(await _tryFile('fees', TEST_FILE_ADDRESS, l2String('aaa'))).to.be.true;
    expect((await join.call('fees', { d: l2String('aaa') })).res).to.equal(
      BigInt(TEST_FILE_ADDRESS)
    );

    const MAX_INT256: SplitUint = SplitUint.fromUint(2n ** 256n - 1n);
    // assertEq(join.line("aaa"), 0);
    //     uint256 maxInt256 = uint256(type(int256).max);
    //     assertTrue(_tryFile("line", "aaa", maxInt256));
    //     assertEq(join.line("aaa"), maxInt256);
    expect(await join.call('line', { d: l2String('aaa') })).to.deep.equal(l2Eth(0));
    expect(await _tryFile('line', MAX_INT256.res, l2String('aaa'))).to.be.true;
    expect(await join.call('line', { d: l2String('aaa') })).to.deep.equal(MAX_INT256);

    // assertTrue(!_tryFile('line', 'aaa', maxInt256 + 1));

    // join.deny(address(this));

    // assertTrue(!_tryFile('vow', address(888)));
    // assertTrue(!_tryFile('fees', 'aaa', address(888)));
    // assertTrue(!_tryFile('line', 'aaa', 10));
    expect(await _tryFile('line', { low: 2n ** 128n, high: 2n ** 128n + 1n }, l2String('aaa'))).to
      .be.false;

    await invoke(admin, join, 'deny', { usr: _admin });
    expect(await _tryFile('vow', TEST_FILE_ADDRESS)).to.be.false;
    expect(await _tryFile('fees', TEST_FILE_ADDRESS, l2String('aaa'))).to.be.false;
    expect(await _tryFile('line', l2Eth(10).res, l2String('aaa'))).to.be.false;
  });

  // function testInvalidWhat() public {
  it('test invalid what', async () => {
    const TEST_FILE_ADDRESS = '9379024284324403537785931406192';
    // assertTrue(!_tryFile('meh', address(888)));
    // assertTrue(!_tryFile('meh', domain, address(888)));
    // assertTrue(!_tryFile('meh', domain, 888));
    expect(await _tryFile('meh', TEST_FILE_ADDRESS)).to.be.false;
    expect(await _tryFile('meh', l2Eth(888).res)).to.be.false;
    expect(await _tryFile('meh', l2Eth(888).res, VALID_DOMAINS)).to.be.false;
  });

  // function testRegister() public {
  it('test register', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    //  assertEq(dai.balanceOf(address(123)), 0);
    //  assertTrue(!_blessed(guid));
    //  assertEq(_pending(guid), 0);
    //  assertEq(_ink(), 0);
    //  assertEq(_art(), 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(l2Eth(0));
    expect(await _blessed(guid)).to.be.equal(0n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(0).res);
    expect(await _art()).to.deep.equal(l2Eth(0).res);
    // join.registerMint(guid);
    await invoke(admin, join, 'registerMint', { teleportGUID: guid });
    //     assertEq(dai.balanceOf(address(123)), 0);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 250_000 ether);
    //     assertEq(_ink(), 0);
    //     assertEq(_art(), 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(l2Eth(0));
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(0).res);
    expect(await _art()).to.deep.equal(l2Eth(0).res);
  });

  // function testRegisterAndWithdrawAll() public {
  it('test register and withdraw all', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    // assertEq(dai.balanceOf(address(123)), 0);
    // assertTrue(!_blessed(guid));
    // assertEq(_pending(guid), 0);
    // assertEq(_ink(), 0);
    // assertEq(_art(), 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(l2Eth(0));
    expect(await _blessed(guid)).to.be.equal(0n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(0).res);
    expect(await _art()).to.deep.equal(l2Eth(0).res);
    // (uint256 daiSent, uint256 totalFee) = join.requestMint(guid, 0, 0);
    const [daiSent, totalFee] = await requestMint(guid, 0, 0);

    // assertEq(dai.balanceOf(address(123)), 250_000 ether);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 0);
    //     assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    //     assertEq(join.cure(), 250_000 * RAD);
    //     assertEq(daiSent, 250_000 * WAD);
    //     assertEq(totalFee, 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('250000'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
    expect(daiSent).to.deep.equal(l2Eth(250000n * WAD).res);
    expect(totalFee).to.deep.equal(l2Eth(0).res);
  });

  // function testRegisterAndWithdrawPartial() public {
  it('test register and withdraw partial', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    // join.file("line", "l2network", 200_000 ether);
    //     (uint256 daiSent, uint256 totalFee) = join.requestMint(guid, 0, 0);

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    const [daiSent, totalFee] = await requestMint(guid, 0, 0);

    // assertEq(dai.balanceOf(address(123)), 200_000 ether);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 50_000 ether);
    //     assertEq(_ink(), 200_000 ether);
    //     assertEq(_art(), 200_000 ether);
    //     assertEq(join.cure(), 200_000 * RAD);
    //     assertEq(daiSent, 200_000 * WAD);
    //     assertEq(totalFee, 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('200000'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));
    expect(daiSent).to.deep.equal(l2Eth(200000n * WAD).res);
    expect(totalFee).to.deep.equal(l2Eth(0).res);
  });

  // function testRegisterAndWithdrawNothing() public {
  it('test register and withdraw nothing', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    // join.file("line", "l2network", 0);
    //     (uint256 daiSent, uint256 totalFee) = join.requestMint(guid, 0, 0);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('0')).res,
    });
    const [daiSent, totalFee] = await requestMint(guid, 0, 0);
    // assertEq(dai.balanceOf(address(123)), 0);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 250_000 ether);
    //     assertEq(_ink(), 0);
    //     assertEq(_art(), 0);
    //     assertEq(join.cure(), 0);
    //     assertEq(daiSent, 0);
    //     assertEq(totalFee, 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('0'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('0')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(0n * RAD));
    expect(daiSent).to.deep.equal(l2Eth(0n * WAD).res);
    expect(totalFee).to.deep.equal(l2Eth(0).res);
  });

  // function testFailRegisterAlreadyRegistered() public {
  it('test fail register already registered', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    //  TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    //     join.requestMint(guid, 0, 0);
    //     join.requestMint(guid, 0, 0);
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    await requestMint(guid, 0, 0);

    try {
      await requestMint(guid, 0, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/already-blessed');
    }
  });

  // function testFailRegisterWrongDomain() public {
  it('test fail register wrong domain', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "etherium",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    //     join.requestMint(guid, 0, 0);
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('etherium'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    try {
      await requestMint(guid, 0, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/incorrect-domain');
    }
  });

  // function testRegisterAndWithdrawPayingFee() public {
  it('test register and withdraw paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //             sourceDomain: "l2network",
    //             targetDomain: "ethereum",
    //             receiver: addressToBytes32(address(123)),
    //             operator: addressToBytes32(address(this)),
    //             amount: 250_000 ether,
    //             nonce: 5,
    //             timestamp: uint48(block.timestamp)
    //         });

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    //         assertEq(vat.dai(vow), 0);
    //         TeleportConstantFee fees = new TeleportConstantFee(100 ether, TTL);
    //         assertEq(fees.fee(), 100 ether);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );
    expect((await fees.call('fee')).fee).to.deep.equal(l2Eth(eth('100')).res);
    // join.file("fees", "l2network", address(fees));
    //         (uint256 daiSent, uint256 totalFee) = join.requestMint(guid, 4 * WAD / 10000, 0); // 0.04% * 250K = 100 (just enough)
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    const [daiSent, totalFee] = await requestMint(guid, (4n * WAD) / 10000n, 0);
    // assertEq(vat.dai(vow), 100 * RAD);
    //     assertEq(dai.balanceOf(address(123)), 249_900 ether);
    //     assertEq(_pending(guid), 0);
    //     assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    //     assertEq(join.cure(), 250_000 * RAD);
    // assertEq(daiSent, 249_900 * WAD);
    // assertEq(totalFee, 100 ether);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(100n * RAD).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('249900'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
    expect(daiSent).to.deep.equal(l2Eth(249900n * WAD).res);
    expect(totalFee).to.deep.equal(l2Eth(eth('100')).res);
  });

  // function testFailRegisterAndWithdrawPayingFee() public {
  it('test fail register and withdraw paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    //  TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    // join.file("fees", "l2network", address(new TeleportConstantFee(100 ether, TTL)));
    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );

    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });

    try {
      //     join.requestMint(guid, 3 * WAD / 10000, 0); // 0.03% * 250K < 100 (not enough)
      await requestMint(guid, (3n * WAD) / 10000n, 0); // 0.03% * 250K < 100 (not enough)
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/max-fee-exceed');
    }
  });

  // function testRegisterAndWithdrawFeeTTLExpires() public {
  it('test register and withdraw fee TTL expires', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // assertEq(vat.dai(vow), 0);
    //     TeleportConstantFee fees = new TeleportConstantFee(100 ether, TTL);
    //     assertEq(fees.fee(), 100 ether);

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    //  join.file("fees", "l2network", address(fees));

    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );
    expect((await fees.call('fee')).fee).to.deep.equal(l2Eth(eth('100')).res);

    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    // Over ttl - you don't pay fees
    //     hevm.warp(block.timestamp + TTL + 1 days);    // Over ttl - you don't pay fees
    //     join.requestMint(guid, 0, 0);
    await starknet.devnet.increaseTime(new Date().getTime() / 1000 + ttl + 86400);
    await starknet.devnet.createBlock();
    await requestMint(guid, 0, 0);
    // assertEq(vat.dai(vow), 0);
    //     assertEq(dai.balanceOf(address(123)), 250_000 ether);
    //     assertEq(_pending(guid), 0);
    //     assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    //     assertEq(join.cure(), 250_000 * RAD);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('250000'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
  });

  // function testRegisterAndWithdrawPartialPayingFee() public {
  it('test register and withdraw partial paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // assertEq(vat.dai(vow), 0);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    //     join.file("line", "l2network", 200_000 ether);
    // join.file("fees", "l2network", address(new TeleportConstantFee(100 ether, TTL)));
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    // join.requestMint(guid, 4 * WAD / 10000, 0); // 0.04% * 200K = 80 (just enough as fee is also proportional)
    await requestMint(guid, (4n * WAD) / 10000n, 0);
    // assertEq(vat.dai(vow), 80 * RAD);
    //     assertEq(dai.balanceOf(address(123)), 199_920 ether);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 50_000 ether);
    //     assertEq(_ink(), 200_000 ether);
    //     assertEq(_art(), 200_000 ether);
    //     assertEq(join.cure(), 200_000 * RAD);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(80n * RAD).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('199920'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));

    // join.file("line", "l2network", 250_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('250000')).res,
    });
    //     join.mintPending(guid, 4 * WAD / 10000, 0); // 0.04% * 50 = 20 (just enough as fee is also proportional)
    await mintPending(guid, (4n * WAD) / 10000n, 0);
    //     assertEq(vat.dai(vow), 100 * RAD);
    //     assertEq(dai.balanceOf(address(123)), 249_900 ether);
    //     assertEq(_pending(guid), 0);
    //     assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    //     assertEq(join.cure(), 250_000 * RAD);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(100n * RAD).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('249900'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
  });

  // function testFailRegisterAndWithdrawPartialPayingFee() public {
  it('test fail register and withdraw partial paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    // assertEq(vat.dai(vow), 0);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    // join.file("line", "l2network", 200_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );
    // join.file("fees", "l2network", address(new TeleportConstantFee(100 ether, TTL)));
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    try {
      // join.requestMint(guid, (3 * WAD) / 10000, 0); // 0.03% * 200K < 80 (not enough)
      await requestMint(guid, (3n * WAD) / 10000n, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/max-fee-exceed');
    }
  });

  // function testFailRegisterAndWithdrawPartialPayingFee2() public {
  it('test fail register and withdraw partial paying fee 2', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // assertEq(vat.dai(vow), 0);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    // join.file("line", "l2network", 200_000 ether);
    // join.file("fees", "l2network", address(new TeleportConstantFee(100 ether, TTL)));
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    //  join.requestMint(guid, 4 * WAD / 10000, 0);
    await requestMint(guid, (4n * WAD) / 10000n, 0);
    // join.file("line", "l2network", 250_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('250000')).res,
    });

    try {
      // join.mintPending(guid, (3 * WAD) / 10000, 0); // 0.03% * 50 < 20 (not enough)
      await mintPending(guid, (3n * WAD) / 10000n, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/max-fee-exceed');
    }
  });

  // function testMintPendingByOperator() public {
  it('test mint pending by operator', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    //  join.file("line", "l2network", 200_000 ether);
    // join.requestMint(guid, 0, 0);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, 0);

    // assertEq(dai.balanceOf(address(this)), 200_000 ether);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 50_000 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('200000')));
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    // join.file("line", "l2network", 225_000 ether);
    // join.mintPending(guid, 0, 0);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });
    await mintPending(guid, 0, 0);
    //  assertEq(dai.balanceOf(address(this)), 225_000 ether);
    // assertEq(_pending(guid), 25_000 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('225000')));
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('25000')).res);
  });

  // function testMintPendingByOperatorNotReceiver() public {
  it('test mint pending by operator not receiver', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // join.file("line", "l2network", 200_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    // join.requestMint(guid, 0, 0);
    await requestMint(guid, 0, 0);
    // assertEq(dai.balanceOf(address(123)), 200_000 ether);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 50_000 ether);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('200000'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    // join.file("line", "l2network", 225_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });
    // join.mintPending(guid, 0, 0);
    await mintPending(guid, 0, 0);
    // assertEq(dai.balanceOf(address(123)), 225_000 ether);
    // assertEq(_pending(guid), 25_000 ether);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('225000'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('25000')).res);
  });

  // function testMintPendingByReceiver() public {
  it('test mint pending by receiver', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: TEST_RECEIVER_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    // join.file("line", "l2network", 200_000 ether);
    // join.requestMint(guid, 0, 0);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, 0);

    // assertEq(dai.balanceOf(address(this)), 200_000 ether);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 50_000 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('200000')));
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);

    // join.file("line", "l2network", 225_000 ether);
    // join.mintPending(guid, 0, 0);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });
    await mintPending(guid, 0, 0);
    // assertEq(dai.balanceOf(address(this)), 225_000 ether);
    //     assertEq(_pending(guid), 25_000 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('225000')));
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('25000')).res);
  });

  // function testFailMintPendingWrongOperator() public {
  it('test fail mint pending wrong operator', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(654)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // join.file("line", "l2network", 200_000 ether);
    // join.requestMint(guid, 0, 0);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, 0);

    // join.file("line", "l2network", 225_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });

    try {
      // join.mintPending(guid, 0, 0);
      await mintPending(guid, 0, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/not-receiver-nor-operator');
    }
  });

  // function testSettle() public {
  it('test settle', async () => {
    // assertEq(join.debt('l2network'), 0);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(0));

    // vat.suck(address(0), address(this), 100_000 * RAD);
    //     daiJoin.exit(address(this), 100_000 ether);
    //     dai.transfer(address(join), 100_000 ether);
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'transfer', {
      recipient: join.address,
      amount: l2Eth(eth('100000')).res,
    });
    // join.settle("l2network", domain, 100_000 ether);
    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    // assertEq(join.debt("l2network"), -100_000 ether);
    // assertEq(join.cure(), 0);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(neg(eth('100000').toBigInt())));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));
  });

  // function testWithdrawNegativeDebt() public {
  it('test withdraw negative debt', async () => {
    // vat.suck(address(0), address(this), 100_000 * RAD);
    //     daiJoin.exit(address(this), 100_000 ether);
    //     dai.transfer(address(join), 100_000 ether);
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'transfer', {
      recipient: join.address,
      amount: l2Eth(eth('100000')).res,
    });
    // join.settle("l2network", domain, 100_000 ether);
    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    // assertEq(join.debt("l2network"), -100_000 ether);
    // assertEq(join.cure(), 0);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(neg(eth('100000').toBigInt())));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(654)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // join.requestMint(guid, 0, 0);
    await requestMint(guid, 0, 0);

    // assertEq(dai.balanceOf(address(123)), 250_000 ether);
    //     assertEq(_ink(), 150_000 ether);
    //     assertEq(_art(), 150_000 ether);
    //     assertEq(join.cure(), 150_000 * RAD);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('250000'))
    );
    expect(await _ink()).to.deep.equal(l2Eth(eth('150000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('150000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(150000n * RAD));
  });

  // function testWithdrawPartialNegativeDebt() public {
  it('test withdraw partial negative debt', async () => {
    //  vat.suck(address(0), address(this), 100_000 * RAD);
    // daiJoin.exit(address(this), 100_000 ether);
    // dai.transfer(address(join), 100_000 ether);
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'transfer', {
      recipient: join.address,
      amount: l2Eth(eth('100000')).res,
    });
    // join.settle("l2network", domain, 100_000 ether);
    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    // assertEq(join.debt("l2network"), -100_000 ether);
    // assertEq(join.cure(), 0);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(neg(eth('100000').toBigInt())));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //     sourceDomain: "l2network",
    //     targetDomain: "ethereum",
    //     receiver: addressToBytes32(address(123)),
    //     operator: addressToBytes32(address(654)),
    //     amount: 250_000 ether,
    //     nonce: 5,
    //     timestamp: uint48(block.timestamp)
    // });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    //  join.file("line", "l2network", 100_000 ether);
    // join.requestMint(guid, 0, 0);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('100000')).res,
    });
    await requestMint(guid, 0, 0);

    // assertEq(dai.balanceOf(address(123)), 200_000 ether);
    //     assertEq(_pending(guid), 50_000 ether);
    //     assertEq(_ink(), 100_000 ether);
    //     assertEq(_art(), 100_000 ether);
    //     assertEq(join.cure(), 100_000 * RAD);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('200000'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(100000n * RAD));
  });

  // function testWithdrawVatCaged() public {
  it('test withdraw vat caged', async () => {
    // vat.suck(address(0), address(this), 100_000 * RAD);
    //     daiJoin.exit(address(this), 100_000 ether);
    //     dai.transfer(address(join), 100_000 ether);
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'transfer', {
      recipient: join.address,
      amount: l2Eth(eth('100000')).res,
    });
    // join.settle("l2network", domain, 100_000 ether);
    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);
    // assertEq(join.debt("l2network"), -100_000 ether);
    // assertEq(join.cure(), 0);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(neg(eth('100000').toBigInt())));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //             sourceDomain: "l2network",
    //             targetDomain: "ethereum",
    //             receiver: addressToBytes32(address(123)),
    //             operator: addressToBytes32(address(654)),
    //             amount: 250_000 ether,
    //             nonce: 5,
    //             timestamp: uint48(block.timestamp)
    //         });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // vat.cage();
    // assertEq(vat.live(), 0);
    await invoke(admin, vat, 'cage');
    expect((await vat.call('live')).live).to.equal(0n);
    // join.file("fees", "l2network", address(new TeleportConstantFee(100 ether, TTL)));
    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    // join.requestMint(guid, 0, 0);
    await requestMint(guid, 0, 0);
    // assertEq(dai.balanceOf(address(123)), 100_000 ether); // Can't pay more than DAI is already in the join
    // assertEq(_pending(guid), 150_000 ether);
    // assertEq(_ink(), 0);
    // assertEq(_art(), 0);
    // assertEq(vat.dai(vow), 0); // No fees regardless the contract set
    // assertEq(join.cure(), 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('100000'))
    ); // Can't pay more than DAI is already in the join
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('150000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('0')).res);
    // No fees regardless the contract set
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));
  });

  // function testSettleVatCaged() public {
  it('test settle vat caged', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(654)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    await requestMint(guid, 0, 0);
    // assertEq(join.debt("l2network"), 250_000 ether);
    // assertEq(_ink(), 250_000 ether);
    // assertEq(_art(), 250_000 ether);
    // assertEq(join.cure(), 250_000 * RAD);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('250000')));
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));

    await invoke(admin, vat, 'cage');
    // vat.suck(address(0), address(this), 250_000 * RAD);
    // daiJoin.exit(address(this), 250_000 ether);
    // dai.transfer(address(join), 250_000 ether);
    await suck(0, _admin, l2Eth(250000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('250000')).res });
    await invoke(admin, dai, 'transfer', {
      recipient: join.address,
      amount: l2Eth(eth('250000')).res,
    });
    // join.settle("l2network", domain, 250_000 ether);
    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('250000')).res);
    // assertEq(join.debt("l2network"), 0);
    // assertEq(_ink(), 250_000 ether);
    // assertEq(_art(), 250_000 ether);
    // assertEq(join.cure(), 250_000 * RAD);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(0));
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
  });

  // function testRegisterAndWithdrawPayingOperatorFee() public {
  it('test register and withdraw paying operator fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // assertEq(dai.balanceOf(address(this)), 0);
    // (uint256 daiSent, uint256 totalFee) = join.requestMint(guid, 0, 250 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(0));
    const [daiSent, totalFee] = await requestMint(guid, 0, eth('250').toBigInt());
    // assertEq(dai.balanceOf(address(this)), 250 ether);
    //     assertEq(dai.balanceOf(address(123)), 249_750 ether);
    //     assertEq(_pending(guid), 0);
    //     assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    //     assertEq(daiSent, 249_750 * WAD);
    //     assertEq(totalFee, 250 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('250')));
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('249750'))
    );

    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(daiSent).to.deep.equal(l2Eth(249750n * WAD).res);
    expect(totalFee).to.deep.equal(l2Eth(eth('250')).res);
  });

  // function testFailOperatorFeeTooHigh() public {
  it('test fail operator fee too high', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //             sourceDomain: "l2network",
    //             targetDomain: "ethereum",
    //             receiver: addressToBytes32(address(123)),
    //             operator: addressToBytes32(address(this)),
    //             amount: 250_000 ether,
    //             nonce: 5,
    //             timestamp: uint48(block.timestamp)
    //         });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    try {
      // join.requestMint(guid, 0, 250_001 ether);   // Slightly over the amount
      await requestMint(guid, 0, eth('250001').toBigInt());
    } catch (err: any) {}
  });

  // function testRegisterAndWithdrawPartialPayingOperatorFee() public {
  it('test register and withdraw partial paying operator fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    //  TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // join.file("line", "l2network", 200_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    // join.requestMint(guid, 0, 200 ether);
    await requestMint(guid, 0, eth('200').toBigInt());
    // assertEq(dai.balanceOf(address(this)), 200 ether);
    //     assertEq(dai.balanceOf(address(123)), 199_800 ether);
    //     assertTrue(_blessed(guid));
    //     assertEq(_pending(guid), 50_000 ether);
    //     assertEq(_ink(), 200_000 ether);
    //     assertEq(_art(), 200_000 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('200')));
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('199800'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('200000')).res);
    // join.file("line", "l2network", 250_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('250000')).res,
    });
    //         join.mintPending(guid, 0, 5 ether);
    await mintPending(guid, 0, eth('5').toBigInt());
    //  assertEq(dai.balanceOf(address(this)), 205 ether);
    //     assertEq(dai.balanceOf(address(123)), 249_795 ether);
    //     assertEq(_pending(guid), 0);
    //     assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('205')));
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('249795'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
  });

  // function testRegisterAndWithdrawPayingTwoFees() public {
  it('test register and withdraw paying two fees', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // assertEq(dai.balanceOf(address(this)), 0);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('0')));

    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('1000')).res,
        ttl_: ttl,
      },
      hre
    );
    // join.file("fees", "l2network", address(new TeleportConstantFee(1000 ether, TTL)));
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    //  join.requestMint(guid, 40 ether / 10000, 249 ether);
    await requestMint(guid, (40n * 10n ** 18n) / 10000n, eth('249').toBigInt());
    // assertEq(dai.balanceOf(address(this)), 249 ether);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('249')));
    // assertEq(vat.dai(vow), 1000 * RAD);
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(1000n * RAD).res);
    // assertEq(dai.balanceOf(address(123)), 248_751 ether);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('248751'))
    );
    // assertEq(_pending(guid), 0);
    //     assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
  });

  // function testFailRegisterAndWithdrawOperatorFeeTooHigh() public {
  it('test fail register and withdraw operator fee too high', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };

    const fees = await simpleDeployL2(
      'teleport_constant_fee',
      {
        fee_: l2Eth(eth('100')).res,
        ttl_: ttl,
      },
      hre
    );
    // join.file("fees", "l2network", address(new TeleportConstantFee(1000 ether, TTL)));
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    try {
      // join.requestMint(guid, 40 ether / 10000, 249_001 ether);    // Too many fees
      await requestMint(guid, (40n * 10n ** 18n) / 10000n, eth('249001').toBigInt());
    } catch (err: any) {}
  });

  // function testTotalDebtSeveralDomains() public {
  it('test total debt several domains', async () => {
    // join.file("line", "l2network_2", 1_000_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network_2'),
      data: l2Eth(eth('1000000')).res,
    });
    // join.file("fees", "l2network_2", address(new TeleportConstantFee(0, TTL)));
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network_2'),
      data: (
        await simpleDeployL2(
          'teleport_constant_fee',
          {
            fee_: l2Eth(0).res,
            ttl_: ttl,
          },
          hre
        )
      ).address,
    });
    // join.file("line", "l2network_3", 1_000_000 ether);
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network_3'),
      data: l2Eth(eth('1000000')).res,
    });
    // join.file("fees", "l2network_3", address(new TeleportConstantFee(0, TTL)));
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network_3'),
      data: (
        await simpleDeployL2(
          'teleport_constant_fee',
          {
            fee_: l2Eth(0).res,
            ttl_: ttl,
          },
          hre
        )
      ).address,
    });
    // vat.suck(address(0), address(this), 100_000 * RAD);
    //     daiJoin.exit(address(this), 100_000 ether);
    //     dai.transfer(address(join), 100_000 ether);
    //     join.settle("l2network", domain, 100_000 ether);
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'transfer', {
      recipient: join.address,
      amount: l2Eth(eth('100000')).res,
    });
    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';
    //  TeleportGUID memory guid = TeleportGUID({
    //             sourceDomain: "l2network_2",
    //             targetDomain: "ethereum",
    //             receiver: addressToBytes32(address(123)),
    //             operator: addressToBytes32(address(654)),
    //             amount: 150_000 ether,
    //             nonce: 5,
    //             timestamp: uint48(block.timestamp)
    //         });
    let guid = {
      source_domain: l2String('l2network_2'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('150000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    await requestMint(guid, 0, 0);
    // guid = TeleportGUID({
    //     sourceDomain: "l2network_3",
    //     targetDomain: "ethereum",
    //     receiver: addressToBytes32(address(123)),
    //     operator: addressToBytes32(address(654)),
    //     amount: 50_000 ether,
    //     nonce: 5,
    //     timestamp: uint48(block.timestamp)
    // });
    // join.requestMint(guid, 0, 0);
    guid = {
      source_domain: l2String('l2network_3'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('50000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    // join.requestMint(guid, 0, 0);
    await requestMint(guid, 0, 0);

    // assertEq(join.debt("l2network"), -100_000 ether);
    //     assertEq(join.debt("l2network_2"), 150_000 ether);
    //     assertEq(join.debt("l2network_3"), 50_000 ether);
    //     assertEq(join.cure(), 200_000 * RAD);
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(neg(eth('100000').toBigInt())));
    expect(await debt(l2String('l2network_2'))).to.deep.equal(l2Eth(eth('150000')));
    expect(await debt(l2String('l2network_3'))).to.deep.equal(l2Eth(eth('50000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));
    // guid = TeleportGUID({
    //             sourceDomain: "l2network",
    //             targetDomain: "ethereum",
    //             receiver: addressToBytes32(address(123)),
    //             operator: addressToBytes32(address(654)),
    //             amount: 50_000 ether,
    //             nonce: 5,
    //             timestamp: uint48(block.timestamp)
    //         });
    //         join.requestMint(guid, 0, 0);
    guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('50000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    await requestMint(guid, 0, 0);

    // assertEq(join.debt("l2network"), -50_000 ether);
    //     assertEq(join.debt("l2network_2"), 150_000 ether);
    //     assertEq(join.debt("l2network_3"), 50_000 ether);
    //     assertEq(join.cure(), 200_000 * RAD);
    // TODO
    // expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-50000')));
    expect(await debt(l2String('l2network_2'))).to.deep.equal(l2Eth(eth('150000')));
    expect(await debt(l2String('l2network_3'))).to.deep.equal(l2Eth(eth('50000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));

    // vat.suck(address(0), address(this), 10_000 * RAD);
    //     daiJoin.exit(address(this), 10_000 ether);
    //     dai.transfer(address(join), 10_000 ether);
    //     join.settle("l2network_3", domain, 10_000 ether);
    await suck(0, _admin, l2Eth(10000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('10000')).res });
    await invoke(admin, dai, 'transfer', {
      recipient: join.address,
      amount: l2Eth(eth('10000')).res,
    });
    await settle(l2String('l2network_3'), VALID_DOMAINS, l2Eth(eth('10000')).res);

    // assertEq(join.debt("l2network"), -50_000 ether);
    //     assertEq(join.debt("l2network_2"), 150_000 ether);
    //     assertEq(join.debt("l2network_3"), 40_000 ether);
    //     assertEq(join.cure(), 190_000 * RAD);
    // expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-50000'))); TODO
    expect(await debt(l2String('l2network_2'))).to.deep.equal(l2Eth(eth('150000')));
    expect(await debt(l2String('l2network_3'))).to.deep.equal(l2Eth(eth('40000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(190000n * RAD));
  });

  // function testCureAfterPositionBeingManipulated() public {
  it('test cure after position being manipulated', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "ethereum",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(this)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    let guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() / 1000,
    };
    //     join.requestMint(guid, 0, 0);
    await requestMint(guid, 0, 0);
    // assertEq(_ink(), 250_000 ether);
    //     assertEq(_art(), 250_000 ether);
    //     assertEq(join.cure(), 250_000 * RAD);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));

    // TODO: Emulate removal of position debt (third party repayment or position being skimmed)
    // hevm.store(
    //   address(vat),
    //   bytes32(
    //     uint256(
    //       keccak256(abi.encode(address(join), keccak256(abi.encode(bytes32(ilk), uint256(2)))))
    //     ) + 1
    //   ),
    //   bytes32(0)
    // );
    await admin.invoke(vat, 'remove_debt', { i: ILK, u: join.address, val: l2Eth(0).res });
    expect(await _art()).to.deep.equal(l2Eth(0).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));

    // In case of not caged, then debt can keep changing which will reload cure to the new value
    // guid = TeleportGUID({
    //     sourceDomain: "l2network",
    //     targetDomain: "ethereum",
    //     receiver: addressToBytes32(address(123)),
    //     operator: addressToBytes32(address(this)),
    //     amount: 100_000 ether,
    //     nonce: 6,
    //     timestamp: uint48(block.timestamp)
    // });
    guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('100000')).res,
      nonce: 6,
      timestamp: new Date().getTime() / 1000,
    };
    // join.requestMint(guid, 0, 0);
    await requestMint(guid, 0, 0);
    //  assertEq(_ink(), 350_000 ether);
    // assertEq(_art(), 100_000 ether);
    // assertEq(join.cure(), 100_000 * RAD);
    expect(await _ink()).to.deep.equal(l2Eth(eth('350000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(100000n * RAD));
  });

  xit('test initiate teleport', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('100000')));
    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(l2Eth(eth('0')));
    expect((await join.call('nonce')).res).to.be.equal(0n);

    await invoke(admin, join, 'initiateTeleport', {
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      amount: l2Eth(eth('100000')).res.low,
      operator: 0,
    });

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('0')));
    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect((await join.call('nonce')).res).to.be.equal(1n);
  });

  xit('test flush', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    await invoke(admin, join, 'initiateTeleport', {
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      amount: l2Eth(eth('100000')).res.low,
      operator: 0,
    });

    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(
      l2Eth(eth('100000'))
    );

    await invoke(admin, join, 'flush', { target_domain: l2String('ethereum') });

    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(l2Eth(eth('0')));
  });

  xit('test fail flush dust', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    await invoke(admin, join, 'initiateTeleport', {
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      amount: l2Eth(eth('100000')).res.low,
      operator: 0,
    });

    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(
      l2Eth(eth('100000'))
    );

    await invoke(admin, join, 'file_fdust', {
      what: l2String('fdust'),
      data: l2Eth(eth('200000')).res,
    });
    try {
      await invoke(admin, join, 'flush', { target_domain: l2String('ethereum') });
    } catch (err: any) {
      expect(err.message).to.contain('DomainGuest/flush-dust');
    }
  });
});
