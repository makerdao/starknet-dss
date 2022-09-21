import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { Account, HttpNetworkConfig, StarknetContract } from 'hardhat/types';
import { pedersen } from 'starknet/dist/utils/hash';

import {
  asDec,
  eth,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  toBytes32,
  l2String,
  invoke,
  MAX_UINT,
  SplitUintType,
} from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = l2String('ethereum');
const TEST_ADDRESS = '9379074284324409537785911406195';
const VOW_ADDRESS = '9379074284324409537785911406192';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

const ILK = l2String('L2-DAI');

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
    _admin = admin.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.address;

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

    teleportRouter = await simpleDeployL2('mock_gateway', {}, hre);

    join = await simpleDeployL2(
      'teleport_join',
      {
        ward: _admin,
        vat_: vat.address,
        daiJoin_: daiJoin.address,
        ilk_: ILK,
        domain_: VALID_DOMAINS,
        router_: teleportRouter.address,
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

    // NEEDED AS WE DONT USE VAT MOCK HERE
    // await admin.invoke(vat, 'rely', { user: join.address });

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
        case 'fdust':
          await invoke(admin, join, 'file_fdust', { what: what_, data });
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
    const tx = await invoke(admin, join, 'requestMint', {
      teleportGUID: guid,
      max_fee_percentage: l2Eth(maxFeePercentage).res,
      operator_fee: l2Eth(operatorFee).res,
    });
    const receipt = await starknet.getTransactionReceipt(tx);
    const decodedEvents = await join.decodeEvents(receipt.events);
    console.log(decodedEvents[1].data.amount);
    return [tx[0], tx[1]];
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

  it('test constructor', async () => {
    expect((await join.call('vat')).res).to.equal(BigInt(vat.address));
    expect((await join.call('daiJoin')).res).to.equal(BigInt(daiJoin.address));
    expect((await join.call('ilk')).res).to.equal(BigInt(ILK));
    expect((await join.call('domain')).res).to.equal(BigInt(VALID_DOMAINS));
    expect((await join.call('wards', { user: _admin })).res).to.be.equal(1n);
  });

  it('test rely deny', async () => {
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.true;
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(1n);
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.true;
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);

    await invoke(admin, join, 'deny', { usr: _admin });
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.false;
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.false;
  });

  it('test file', async () => {
    const TEST_FILE_ADDRESS = '9379024284324403537785931406192';

    expect((await join.call('vow')).res).to.equal(BigInt(VOW_ADDRESS));
    expect(await _tryFile('vow', TEST_FILE_ADDRESS)).to.be.true;
    expect((await join.call('vow')).res).to.equal(BigInt(TEST_FILE_ADDRESS));

    expect(await join.call('fdust')).to.deep.equal(l2Eth(0));
    expect(await _tryFile('fdust', l2Eth(888).res)).to.be.true;
    expect(await join.call('fdust')).to.deep.equal(l2Eth(888));

    expect((await join.call('fees', { d: l2String('aaa') })).res).to.equal(0n);
    expect(await _tryFile('fees', TEST_FILE_ADDRESS, l2String('aaa'))).to.be.true;
    expect((await join.call('fees', { d: l2String('aaa') })).res).to.equal(
      BigInt(TEST_FILE_ADDRESS)
    );

    const MAX_INT256: SplitUint = SplitUint.fromUint(2n ** 256n - 1n);

    expect(await join.call('line', { d: l2String('aaa') })).to.deep.equal(l2Eth(0));
    expect(await _tryFile('line', MAX_INT256.res, l2String('aaa'))).to.be.true;
    expect(await join.call('line', { d: l2String('aaa') })).to.deep.equal(MAX_INT256);

    expect(await _tryFile('line', { low: 2n ** 128n, high: 2n ** 128n + 1n }, l2String('aaa'))).to
      .be.false;

    await invoke(admin, join, 'deny', { usr: _admin });
    expect(await _tryFile('vow', TEST_FILE_ADDRESS)).to.be.false;
    expect(await _tryFile('fees', TEST_FILE_ADDRESS, l2String('aaa'))).to.be.false;
    expect(await _tryFile('line', l2Eth(10).res, l2String('aaa'))).to.be.false;
  });

  it('test invalid what', async () => {
    const TEST_FILE_ADDRESS = '9379024284324403537785931406192';

    expect(await _tryFile('meh', TEST_FILE_ADDRESS)).to.be.false;
    expect(await _tryFile('meh', l2Eth(888).res)).to.be.false;
    expect(await _tryFile('meh', TEST_FILE_ADDRESS), VALID_DOMAINS).to.be.false;
    expect(await _tryFile('meh', l2Eth(888).res, VALID_DOMAINS)).to.be.false;
  });

  it('test register', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(l2Eth(0));
    expect(await _blessed(guid)).to.be.equal(0n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(0).res);
    expect(await _art()).to.deep.equal(l2Eth(0).res);

    await admin.invoke(join, 'registerMint', { teleportGUID: guid });

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(l2Eth(0));
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(0).res);
    expect(await _art()).to.deep.equal(l2Eth(0).res);
  });

  it('test register and withdraw all', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(l2Eth(0));
    expect(await _blessed(guid)).to.be.equal(0n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(0).res);
    expect(await _art()).to.deep.equal(l2Eth(0).res);

    const [daiSent, totalFee] = await requestMint(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('250000'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
    // TODO : get return values from invoke
    // expect(daiSent).to.deep.equal(l2Eth(250000n * WAD));
    // expect(totalFee).to.deep.equal(l2Eth(0));
  });

  it('test register and withdraw partial', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    const [daiSent, totalFee] = await requestMint(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('200000'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));
    // expect(daiSent).to.deep.equal(l2Eth(200000n * WAD));
    // expect(totalFee).to.deep.equal(l2Eth(0));
  });

  it('test register and withdraw nothing', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('0')).res,
    });
    const [daiSent, totalFee] = await requestMint(guid, 0, 0);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('0'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('0')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(0n * RAD));
    // expect(daiSent).to.deep.equal(l2Eth(0n * WAD));
    // expect(totalFee).to.deep.equal(l2Eth(0));
  });

  it('test fail register already registered', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await requestMint(guid, 0, 0);

    try {
      await requestMint(guid, 0, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/already-blessed');
    }
  });

  it('test fail register wrong domain', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('etherium'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    try {
      await requestMint(guid, 0, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/incorrect-domain');
    }
  });

  it('test register and withdraw paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

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

    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    const [daiSent, totalFee] = await requestMint(guid, (4n * WAD) / 10000n, 0);

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(100n * RAD).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('249900'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
    // expect(daiSent).to.deep.equal(l2Eth(249900n * WAD));
    // expect(totalFee).to.deep.equal(l2Eth(eth('100')));
  });

  it('test fail register and withdraw paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

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
      await requestMint(guid, (3n * WAD) / 10000n, 0); // 0.03% * 250K < 100 (not enough)
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/max-fee-exceed');
    }
  });

  it('test register and withdraw fee TTL expires', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

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

    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: l2String('l2network'),
      data: fees.address,
    });
    // Over ttl - you don't pay fees
    await starknet.devnet.increaseTime(new Date().getTime() * 1000 + ttl + 86400);
    await starknet.devnet.createBlock();
    await requestMint(guid, 0, 0);

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('250000'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
  });

  it('test register and withdraw partial paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);

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
    // 0.04% * 200K = 80 (just enough as fee is also proportional)
    await requestMint(guid, (4n * WAD) / 10000n, 0);

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(80n * RAD).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('199920'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('250000')).res,
    });
    await mintPending(guid, (4n * WAD) / 10000n, 0);

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(100n * RAD).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('249900'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));
  });

  it('test fail register and withdraw partial paying fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);

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
    try {
      await requestMint(guid, (3n * WAD) / 10000n, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/max-fee-exceed');
    }
  });

  it('test fail register and withdraw partial paying fee 2', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(0).res);

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
    await requestMint(guid, (4n * WAD) / 10000n, 0);

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('250000')).res,
    });

    try {
      // 0.03% * 50 < 20 (not enough)
      await mintPending(guid, (3n * WAD) / 10000n, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/max-fee-exceed');
    }
  });

  it('test mint pending by operator', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('200000')));
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });
    await mintPending(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('225000')));
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('25000')).res);
  });

  it('test mint pending by operator not receiver', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('200000'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });
    await mintPending(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('225000'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('25000')).res);
  });

  it('test mint pending by receiver', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: _admin,
      operator: TEST_RECEIVER_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('200000')));
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });
    await mintPending(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('225000')));
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('25000')).res);
  });

  it('test fail mint pending wrong operator', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, 0);

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('225000')).res,
    });

    try {
      await mintPending(guid, 0, 0);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportJoin/not-receiver-nor-operator');
    }
  });

  it('test settle', async () => {
    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(0));

    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-100000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));
  });

  it('test withdraw negative debt', async () => {
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-100000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await requestMint(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('250000'))
    );
    expect(await _ink()).to.deep.equal(l2Eth(eth('150000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('150000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(150000n * RAD));
  });

  it('test withdraw partial negative debt', async () => {
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-100000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('100000')).res,
    });
    await requestMint(guid, 0, 0);

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('200000'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(100000n * RAD));
  });

  it('test withdraw vat caged', async () => {
    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-100000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(0));

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, vat, 'cage');
    expect((await vat.call('live')).live).to.equal(0n);

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
    await requestMint(guid, 0, 0);

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

  it('test settle vat caged', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await requestMint(guid, 0, 0);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('250000')));
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));

    await invoke(admin, vat, 'cage');

    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('250000')).res);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(0));
    expect(await _ink()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(100000n * RAD));
  });

  it('test register and withdraw paying operator fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(0));
    const [daiSent, totalFee] = await requestMint(guid, 0, eth('250').toBigInt());

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('250')));
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('249750')));

    expect(await _pending(guid)).to.deep.equal(l2Eth(0).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
    // expect(daiSent).to.deep.equal(l2Eth(249750n * WAD).res);
    // expect(totalFee).to.deep.equal(l2Eth(eth('250')).res);
  });

  it('test fail operator fee too high', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    try {
      await requestMint(guid, 0, eth('250001').toBigInt());
    } catch (err: any) {}
  });

  it('test register and withdraw partial paying operator fee', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('200000')).res,
    });
    await requestMint(guid, 0, eth('200').toBigInt());

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('200')));
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('199800'))
    );
    expect(await _blessed(guid)).to.be.equal(1n);
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('50000')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('200000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('200000')).res);

    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network'),
      data: l2Eth(eth('250000')).res,
    });
    await mintPending(guid, 0, eth('5').toBigInt());

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('205')));
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('249795'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
  });

  it('test register and withdraw paying two fees', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('0')));

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
    await requestMint(guid, (40n * 10n ** 18n) / 10000n, eth('249').toBigInt());
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('249')));
    expect((await vat.call('dai', { u: VOW_ADDRESS })).dai).to.deep.equal(l2Eth(1000n * RAD).res);
    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(
      l2Eth(eth('248_751'))
    );
    expect(await _pending(guid)).to.deep.equal(l2Eth(eth('0')).res);
    expect(await _ink()).to.deep.equal(l2Eth(eth('250000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('250000')).res);
  });

  it('test fail register and withdraw operator fee too high', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

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
      await requestMint(guid, (40n * 10n ** 18n) / 10000n, eth('249001').toBigInt());
    } catch (err: any) {}
  });

  it('test total debt several domains', async () => {
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network_2'),
      data: l2Eth(eth('1_000_000')).res,
    });
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
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: l2String('l2network_3'),
      data: l2Eth(eth('1_000_000')).res,
    });
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

    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });
    await settle(l2String('l2network'), VALID_DOMAINS, l2Eth(eth('100000')).res);

    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';
    const TEST_OPERATOR_ADDRESS = '9379024284324553537185931466192';

    let guid = {
      source_domain: l2String('l2network_2'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('150000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };
    await requestMint(guid, 0, 0);

    guid = {
      source_domain: l2String('l2network_3'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('50000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };
    await requestMint(guid, 0, 0);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-100000')));
    expect(await debt(l2String('l2network_2'))).to.deep.equal(l2Eth(eth('150000')));
    expect(await debt(l2String('l2network_3'))).to.deep.equal(l2Eth(eth('50000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));

    guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: TEST_OPERATOR_ADDRESS,
      amount: l2Eth(eth('50000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };
    await requestMint(guid, 0, 0);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-50000')));
    expect(await debt(l2String('l2network_2'))).to.deep.equal(l2Eth(eth('150000')));
    expect(await debt(l2String('l2network_3'))).to.deep.equal(l2Eth(eth('50000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(200000n * RAD));

    await suck(0, _admin, l2Eth(10000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('10000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });
    await settle(l2String('l2network_3'), VALID_DOMAINS, l2Eth(eth('10000')).res);

    expect(await debt(l2String('l2network'))).to.deep.equal(l2Eth(eth('-50000')));
    expect(await debt(l2String('l2network_2'))).to.deep.equal(l2Eth(eth('150000')));
    expect(await debt(l2String('l2network_3'))).to.deep.equal(l2Eth(eth('40000')));
    expect(await join.call('cure')).to.deep.equal(l2Eth(190000n * RAD));
  });

  it('test cure after position being manipulated', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    let guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };
    await requestMint(guid, 0, 0);

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
    expect(await _art()).to.deep.equal(l2Eth(0));
    expect(await join.call('cure')).to.deep.equal(l2Eth(250000n * RAD));

    // In case of not caged, then debt can keep changing which will reload cure to the new value
    guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      operator: _admin,
      amount: l2Eth(eth('100000')).res,
      nonce: 6,
      timestamp: new Date().getTime() * 1000,
    };
    await requestMint(guid, 0, 0);

    expect(await _ink()).to.deep.equal(l2Eth(eth('350000')).res);
    expect(await _art()).to.deep.equal(l2Eth(eth('100000')).res);
    expect(await join.call('cure')).to.deep.equal(l2Eth(100000n * RAD));
  });

  it('test initiate teleport', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    await suck(0, _admin, l2Eth(100000n * RAD).res);
    await invoke(admin, daiJoin, 'exit', { usr: _admin, wad: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: join.address,
      amount: l2Eth(eth('100000')).res,
    });

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('100000')));
    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect(await join.call('nonce')).to.be.equal(0);

    await invoke(admin, join, 'initiateTeleport', {
      target_domain: l2String('ethereum'),
      receiver: TEST_RECEIVER_ADDRESS,
      amount: l2Eth(eth('100000')).res,
      operator: 0,
    });

    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('0')));
    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect(await join.call('nonce')).to.be.equal(1);
  });

  it('test flush', async () => {
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
      amount: l2Eth(eth('100000')).res,
      operator: 0,
    });

    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(
      l2Eth(eth('100000'))
    );

    await invoke(admin, join, 'flush', { target_domain: l2String('ethereum') });

    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(l2Eth(eth('0')));
  });

  it('test fail flush dust', async () => {
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
      amount: l2Eth(eth('100000')).res,
      operator: 0,
    });

    expect(await join.call('batches', { d: l2String('ethereum') })).to.deep.equal(
      l2Eth(eth('100000'))
    );

    await invoke(admin, join, 'file_fdust', { what: 'fdust', data: l2Eth(eth('200000')).res });
    try {
      await invoke(admin, join, 'flush', { target_domain: l2String('ethereum') });
    } catch (err: any) {
      expect(err.message).to.contain('DomainGuest/flush-dust');
    }
  });
});
