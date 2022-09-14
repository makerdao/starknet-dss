import { expect } from 'chai';
import hre, { network, starknet } from 'hardhat';
import { Account, HttpNetworkConfig, StarknetContract } from 'hardhat/types';

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
} from './utils';

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = '9379074284324409537785911406195';
const TEST_ADDRESS = '9379074284324409537785911406195';
const VOW_ADDRESS = '9379074284324409537785911406192';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

const ILK = l2String('L2-DAI');

const zero_uint = { low: 0n, high: 0n };

const fee = eth('0.01');
const ttl = 60 * 60 * 24 * 8; // 8 days

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

    vat = await simpleDeployL2(
      'vat',
      {
        ward: _admin,
      },
      hre
    );

    dai = await simpleDeployL2(
      'dai',
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

    console.log('a');
    await invoke(admin, join, 'file_line', {
      what: l2String('line'),
      domain_: VALID_DOMAINS,
      data: l2Eth(eth('1000000')).res,
    });
    console.log('b');
    await invoke(admin, join, 'file_vow', {
      what: l2String('vow'),
      data: VOW_ADDRESS,
    });
    console.log('c');
    await invoke(admin, join, 'file_fees', {
      what: l2String('fees'),
      domain_: VALID_DOMAINS,
      data: teleportConstantFee.address,
    });
    console.log('d');

    await invoke(admin, vat, 'hope', { user: daiJoin.address });

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('unittest-dump.dmp');
  });

  async function _ink() {
    const _urn = await vat.call('urns', { i: await join.call('ilk'), u: join.address });
    return _urn[0];
  }

  async function _art() {
    const _urn = await vat.call('urns', { i: await join.call('ilk'), u: join.address });
    return _urn[1];
  }

  async function _blessed(guid: any) {
    const _teleport = await join.call('teleports', { hash: getGUIDHash(guid) });
    return _teleport[0];
  }

  async function _pending(guid: any) {
    const _teleport = await join.call('teleports', { hash: getGUIDHash(guid) });
    return _teleport[1];
  }

  async function _tryRely(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, join, 'rely', { usr });
      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  async function _tryDeny(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, join, 'deny', { usr });
      return Promise.resolve(true);
    } catch (error) {
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

  it('test constructor', async () => {
    expect((await join.call('vat')).res).to.equal(vat.address);
    expect((await join.call('daiJoin')).res).to.equal(daiJoin.address);
    expect((await join.call('ilk')).res).to.equal(ILK);
    expect((await join.call('domain')).res).to.equal(VALID_DOMAINS);
    expect((await join.call('wards', { user: _admin })).res).to.be.true;
  });

  it('test rely deny', async () => {
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.false;
    expect(_tryRely(admin, TEST_ADDRESS)).to.be.true;
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.true;
    expect(_tryDeny(admin, TEST_ADDRESS)).to.be.true;
    expect((await join.call('wards', { user: TEST_ADDRESS })).res).to.be.false;

    await invoke(admin, join, 'deny', { usr: _admin });
    expect(_tryRely(admin, TEST_ADDRESS)).to.be.false;
    expect(_tryDeny(admin, TEST_ADDRESS)).to.be.false;
  });

  it('test file', async () => {
    const TEST_FILE_ADDRESS = '9379024284324403537785931406192';

    expect((await join.call('vow')).res).to.equal(VOW_ADDRESS);
    expect(await _tryFile('vow', TEST_FILE_ADDRESS)).to.be.true;
    expect((await join.call('vow')).res).to.equal(TEST_FILE_ADDRESS);

    expect(await join.call('fdust')).to.deep.equal(l2Eth(0));
    expect(await _tryFile('fdust', l2Eth(888).res)).to.be.true;
    expect(await join.call('fdust')).to.deep.equal(l2Eth(888));

    expect(await join.call('fees', { d: l2String('aaa') })).to.equal(0);
    expect(await _tryFile('fees', TEST_FILE_ADDRESS, l2String('aaa'))).to.be.true;
    expect(await join.call('fees', { d: l2String('aaa') })).to.equal(TEST_FILE_ADDRESS);

    const MAX_INT256: SplitUint = SplitUint.fromUint(2n ** 256n - 1n);

    expect(await join.call('line', { d: l2String('aaa') })).to.deep.equal(l2Eth(0));
    expect(_tryFile('line', MAX_INT256.res, l2String('aaa'))).to.be.true;
    expect(await join.call('line', { d: l2String('aaa') })).to.deep.equal(MAX_INT256);

    expect(_tryFile('line', MAX_INT256.add(1n).res, l2String('aaa'))).to.be.false;

    await invoke(admin, join, 'deny', { usr: _admin });
    expect(await _tryFile('vow', TEST_FILE_ADDRESS)).to.be.false;
    expect(await _tryFile('fees', TEST_FILE_ADDRESS, l2String('aaa'))).to.be.false;
    expect(_tryFile('line', l2Eth(10).res, l2String('aaa'))).to.be.false;
  });

  it('test invalid what', async () => {
    const TEST_FILE_ADDRESS = '9379024284324403537785931406192';

    expect(_tryFile('meh', TEST_FILE_ADDRESS)).to.be.false;
    expect(_tryFile('meh', l2Eth(888).res)).to.be.false;
    expect(_tryFile('meh', TEST_FILE_ADDRESS), VALID_DOMAINS).to.be.false;
    expect(_tryFile('meh', l2Eth(888).res, VALID_DOMAINS)).to.be.false;
  });

  it('test register', async () => {
    const TEST_RECEIVER_ADDRESS = '9379024284324443537185931466192';

    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('ethereum'),
      receiver: toBytes32(TEST_RECEIVER_ADDRESS),
      operator: toBytes32(_admin),
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    expect(await dai.call('balanceOf', { user: TEST_RECEIVER_ADDRESS })).to.deep.equal(l2Eth(0));
    expect(await _blessed(guid)).to.be.false;
    expect(await _pending(guid)).to.deep.equal(l2Eth(0));
    expect(await _ink()).to.deep.equal(l2Eth(0));
    expect(await _art()).to.deep.equal(l2Eth(0));
  });
});
