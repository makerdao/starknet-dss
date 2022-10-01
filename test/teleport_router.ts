import { Account } from '@shardlabs/starknet-hardhat-plugin/dist/src/account';
import { StarknetContract } from '@shardlabs/starknet-hardhat-plugin/dist/src/types';
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
  invoke,
  SplitUintType,
} from './utils';

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

describe('teleport router', async function () {
  this.timeout(900_000);
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let dai: StarknetContract;
  let teleportJoin: string;
  let router: StarknetContract;

  const l1Domain = l2String('ethereum');

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));

    admin = await starknet.deployAccount('OpenZeppelin');
    _admin = admin.starknetContract.address;
    user1 = await starknet.deployAccount('OpenZeppelin');
    _user1 = user1.starknetContract.address;
    user2 = await starknet.deployAccount('OpenZeppelin');
    _user2 = user2.starknetContract.address;

    dai = await simpleDeployL2('mock_token', { ward: _admin }, hre);
    teleportJoin = (await simpleDeployL2('mock_gateway', {}, hre)).address;
    router = await simpleDeployL2('teleport_router', { ward: _admin, dai: dai.address }, hre);

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('unittest-dump.dmp');
  });

  async function _tryRely(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, router, 'rely', { usr });
      return Promise.resolve(true);
    } catch (error) {
      // console.error(error);
      return Promise.resolve(false);
    }
  }

  async function _tryDeny(account: Account, usr: string): Promise<boolean> {
    try {
      await invoke(account, router, 'deny', { usr });
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
        case 'gateway':
          await invoke(admin, router, 'file', { what: what_, domain, data });
          break;
        case 'parent':
          await invoke(admin, router, 'file_parent', { what: what_, data });
          break;
        default:
          return Promise.resolve(false);
      }
      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  async function settle(
    source_domain: string,
    target_domain: string,
    amount: SplitUintType<bigint>
  ) {
    await invoke(admin, router, 'settle', { source_domain, target_domain, amount });
  }

  it('test constructor', async () => {
    expect((await router.call('dai')).res).to.be.equal(BigInt(dai.address));
    expect((await router.call('wards', { user: _admin })).res).to.be.equal(1n);
  });

  it('test rely deny', async () => {
    expect((await router.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.true;
    expect((await router.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(1n);
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.true;
    expect((await router.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);

    await invoke(admin, router, 'deny', { usr: _admin });
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.false;
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.false;
  });

  it('test file fails when not authed', async () => {
    expect(await _tryFile('gateway', TEST_ADDRESS, l2String('dom'))).to.be.true;
    expect(await _tryFile('parent', TEST_ADDRESS)).to.be.true;
    await invoke(admin, router, 'deny', { usr: _admin });
    expect(await _tryFile('gateway', TEST_ADDRESS, l2String('dom'))).to.be.false;
    expect(await _tryFile('parent', TEST_ADDRESS)).to.be.false;
  });

  it('test file new domains', async () => {
    const domain1 = l2String('newdom1');
    const gateway1 = 111n;
    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(0n);
    expect((await router.call('numDomains')).res).to.be.equal(0n);

    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));

    const domain2 = l2String('newdom2');
    const gateway2 = 222n;
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(0n);

    expect(await _tryFile('gateway', gateway2, domain2)).to.be.true;

    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(2n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));
    expect((await router.call('domainAt', { index: 2n })).res).to.be.equal(BigInt(domain2));
  });

  it('test file new gateway for existing domain', async () => {
    const domain = l2String('dom');
    const gateway1 = 111n;
    expect(await _tryFile('gateway', gateway1, domain)).to.be.true;
    expect((await router.call('gateways', { domain: domain })).res).to.be.equal(gateway1);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain));

    const gateway2 = 222n;
    expect(await _tryFile('gateway', gateway2, domain)).to.be.true;
    expect((await router.call('gateways', { domain: domain })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain));
  });

  it('test file remove last domain', async () => {
    const domain = l2String('dom');
    const gateway = 111n;
    expect(await _tryFile('gateway', gateway, domain)).to.be.true;
    expect((await router.call('gateways', { domain })).res).to.be.equal(gateway);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain));

    // Remove last domain
    expect(await _tryFile('gateway', 0n, domain)).to.be.true;

    expect((await router.call('gateways', { domain })).res).to.be.equal(0n);
    expect((await router.call('hasDomain', { domain })).res).to.be.equal(0n);
  });

  it('test file remove not last domain', async () => {
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    const gateway2 = 222n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway2, domain2)).to.be.true;
    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(2n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));
    expect((await router.call('domainAt', { index: 2n })).res).to.be.equal(BigInt(domain2));

    // Remove first domain
    expect(await _tryFile('gateway', 0, domain1)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(0n);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain2));

    // Re-add removed domain
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(2n);
    // domains have been swapped compared to initial state
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain2));
    expect((await router.call('domainAt', { index: 2n })).res).to.be.equal(BigInt(domain1));
  });

  it('test file two domains same gateway', async () => {
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;
    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway1);
    expect((await router.call('numDomains')).res).to.be.equal(2n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));
    expect((await router.call('domainAt', { index: 2n })).res).to.be.equal(BigInt(domain2));
  });

  it('test file two domains same gateway remove 1', async () => {
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    expect(await _tryFile('gateway', 0n, domain2)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(0n);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));
  });

  it('test file two domains same gateway remove 2', async () => {
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    expect(await _tryFile('gateway', 0n, domain1)).to.be.true;
    expect(await _tryFile('gateway', 0n, domain2)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(0n);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(0n);
    expect((await router.call('numDomains')).res).to.be.equal(0n);
  });

  it('test file two domains same gateway split', async () => {
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    const gateway2 = 222n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    expect(await _tryFile('gateway', gateway2, domain2)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(2n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));
    expect((await router.call('domainAt', { index: 2n })).res).to.be.equal(BigInt(domain2));
  });

  it('test file two domains same gateway split remove', async () => {
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    const gateway2 = 222n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    expect(await _tryFile('gateway', gateway2, domain2)).to.be.true;
    expect(await _tryFile('gateway', 0n, domain1)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(0n);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain2));
  });

  it('test file parent', async () => {
    expect(await _tryFile('parent', TEST_ADDRESS)).to.be.true;

    expect((await router.call('parent')).res).to.be.equal(BigInt(TEST_ADDRESS));
  });

  it('test file invalid what', async () => {
    expect(await _tryFile('meh', TEST_ADDRESS, l2String('aaa'))).to.be.false;
    expect(await _tryFile('meh', TEST_ADDRESS)).to.be.false;
  });

  it('test fail register mint from not gateway', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l1Domain,
      receiver: 123n,
      operator: 234n,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await _tryFile('gateway', 555n, l2String('l2network'));

    try {
      await admin.invoke(router, 'registerMint', { teleportGUID: guid });
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/sender-not-gateway');
    }
  });

  it('test register mint targeting L1', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l1Domain,
      receiver: 123n,
      operator: 234n,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await _tryFile('gateway', _admin, l2String('l2network'));
    await _tryFile('gateway', teleportJoin, l1Domain);

    await admin.invoke(router, 'registerMint', { teleportGUID: guid });
  });

  it('test register mint targeting L1', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('another-l2network'),
      receiver: 123n,
      operator: 234n,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await _tryFile('gateway', _admin, l2String('l2network'));
    const _gateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', _gateway.address, l2String('another-l2network'));

    await admin.invoke(router, 'registerMint', { teleportGUID: guid });
  });

  it('test fail register mint targeting invalid domain', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('invalid-network'),
      receiver: 123n,
      operator: 234n,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await _tryFile('gateway', _admin, l2String('l2network'));

    try {
      await admin.invoke(router, 'registerMint', { teleportGUID: guid });
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/unsupported-target-domain');
    }
  });

  it('test register mint from parent', async () => {
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('another-l2network'),
      receiver: 123n,
      operator: 234n,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await _tryFile('parent', _admin);
    const _gateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', _gateway.address, l2String('another-l2network'));

    await admin.invoke(router, 'registerMint', { teleportGUID: guid });
  });

  it('test fail settle from not gateway', async () => {
    await _tryFile('gateway', 555n, l2String('l2network'));
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });

    try {
      await settle(l2String('l2network'), l1Domain, l2Eth(eth('100')).res);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/sender-not-gateway');
    }
  });

  it('test settle targeting L1', async () => {
    await _tryFile('gateway', _admin, l2String('l2network'));
    await _tryFile('gateway', teleportJoin, l1Domain);
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });

    await settle(l2String('l2network'), l1Domain, l2Eth(eth('100')).res);
  });

  it('test settle targeting L2', async () => {
    await _tryFile('gateway', _admin, l2String('l2network'));
    const _gateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', _gateway.address, l2String('another-l2network'));
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });

    await settle(l2String('l2network'), l2String('another-l2network'), l2Eth(eth('100')).res);
  });

  it('test settle from parent', async () => {
    await _tryFile('parent', _admin);
    const _gateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', _gateway.address, l2String('another-l2network'));
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });

    await settle(l2String('l2network'), l2String('another-l2network'), l2Eth(eth('100')).res);
  });

  it('test fail settle targeting invalid domain', async () => {
    await _tryFile('gateway', _admin, l2String('l2network'));

    try {
      await settle(l2String('l2network'), l2String('invalid-network'), l2Eth(eth('100')).res);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/unsupported-target-domain');
    }
  });
});
