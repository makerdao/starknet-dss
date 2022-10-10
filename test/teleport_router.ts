import { Account } from '@shardlabs/starknet-hardhat-plugin/dist/src/account';
import { StarknetContract } from '@shardlabs/starknet-hardhat-plugin/dist/src/types';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import hre, { starknet } from 'hardhat';
import { toFelt } from 'starknet/utils/number';

import { eth, l2Eth, simpleDeployL2, l2String, invoke, SplitUintType } from './utils';

// Cairo encoding of "valid_domains"
const TEST_ADDRESS = '9379074284324409537785911406195';
const DOMAIN = l2String('rollup');
const PARENT_DOMAIN = l2String('ethereum');

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
    router = await simpleDeployL2(
      'teleport_router',
      { ward: _admin, dai: dai.address, domain: DOMAIN, parent_domain: PARENT_DOMAIN },
      hre
    );

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
        case 'fdust':
          await invoke(admin, router, 'file_fdust', { what: what_, data });
          break;
        default:
          return Promise.resolve(false);
      }
      return Promise.resolve(true);
    } catch (error) {
      // console.error(error);
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

  async function initiateTeleport(
    target_domain: string,
    receiver: string | bigint,
    amount: string,
    operator?: string
  ) {
    await invoke(admin, router, 'initiateTeleport', {
      target_domain,
      receiver,
      amount: toFelt(amount),
      operator: operator ?? 0n,
    });
  }

  it('test constructor', async () => {
    // assertEq(address(router.dai()), dai);
    // assertEq(router.domain(), domain);
    // assertEq(router.parentDomain(), parentDomain);
    // assertEq(router.wards(address(this)), 1);
    expect((await router.call('dai')).res).to.be.equal(BigInt(dai.address));
    expect((await router.call('domain')).res).to.be.equal(BigInt(DOMAIN));
    expect((await router.call('parentDomain')).res).to.be.equal(BigInt(PARENT_DOMAIN));
    expect((await router.call('wards', { user: _admin })).res).to.be.equal(1n);
  });

  it('test rely deny', async () => {
    // assertEq(router.wards(address(456)), 0);
    // assertTrue(_tryRely(address(456)));
    // assertEq(router.wards(address(456)), 1);
    // assertTrue(_tryDeny(address(456)));
    // assertEq(router.wards(address(456)), 0);
    expect((await router.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.true;
    expect((await router.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(1n);
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.true;
    expect((await router.call('wards', { user: TEST_ADDRESS })).res).to.be.equal(0n);

    // router.deny(address(this));

    // assertTrue(!_tryRely(address(456)));
    // assertTrue(!_tryDeny(address(456)));

    await invoke(admin, router, 'deny', { usr: _admin });
    expect(await _tryRely(admin, TEST_ADDRESS)).to.be.false;
    expect(await _tryDeny(admin, TEST_ADDRESS)).to.be.false;
  });

  it('test file new domains', async () => {
    //     bytes32 domain1 = "newdom1";
    //     address gateway1 = address(111);
    //     assertEq(router.gateways(domain1), address(0));
    //     assertEq(router.numDomains(), 0);

    //     assertTrue(_tryFile("gateway", domain1, gateway1));

    //     assertEq(router.gateways(domain1), gateway1);
    //     assertEq(router.numDomains(), 1);
    //     assertEq(router.domainAt(0), domain1);

    //     bytes32 domain2 = "newdom2";
    //     address gateway2 = address(222);
    //     assertEq(router.gateways(domain2), address(0));

    //     assertTrue(_tryFile("gateway", domain2, gateway2));

    //     assertEq(router.gateways(domain2), gateway2);
    //     assertEq(router.numDomains(), 2);
    //     assertEq(router.domainAt(0), domain1);
    //     assertEq(router.domainAt(1), domain2);
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
    // bytes32 domain1 = "dom";
    // address gateway1 = address(111);
    // assertTrue(_tryFile("gateway", domain1, gateway1));
    // assertEq(router.gateways(domain1), gateway1);
    // assertEq(router.numDomains(), 1);
    // assertEq(router.domainAt(0), domain1);
    const domain = l2String('dom');
    const gateway1 = 111n;
    expect(await _tryFile('gateway', gateway1, domain)).to.be.true;
    expect((await router.call('gateways', { domain: domain })).res).to.be.equal(gateway1);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain));
    // address gateway2 = address(222);
    // assertTrue(_tryFile('gateway', domain1, gateway2));

    // assertEq(router.gateways(domain1), gateway2);
    // assertEq(router.numDomains(), 1);
    // assertEq(router.domainAt(0), domain1);

    const gateway2 = 222n;
    expect(await _tryFile('gateway', gateway2, domain)).to.be.true;
    expect((await router.call('gateways', { domain: domain })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain));
  });

  it('test file remove last domain', async () => {
    // bytes32 domain1 = "dom";
    // address gateway = address(111);
    // assertTrue(_tryFile("gateway", domain1, gateway));
    // assertEq(router.gateways(domain1), gateway);
    // assertEq(router.numDomains(), 1);
    // assertEq(router.domainAt(0), domain1);
    const domain = l2String('dom');
    const gateway = 111n;
    expect(await _tryFile('gateway', gateway, domain)).to.be.true;
    expect((await router.call('gateways', { domain })).res).to.be.equal(gateway);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain));

    // Remove last domain1
    // assertTrue(_tryFile('gateway', domain1, address(0)));

    // assertEq(router.gateways(domain1), address(0));
    // assertTrue(!router.hasDomain(domain1));
    // assertEq(router.numDomains(), 0);
    expect(await _tryFile('gateway', 0n, domain)).to.be.true;

    expect((await router.call('gateways', { domain })).res).to.be.equal(0n);
    expect((await router.call('hasDomain', { domain })).res).to.be.equal(0n);
    expect((await router.call('numDomains')).res).to.be.equal(0n);
  });

  it('test file remove not last domain', async () => {
    // bytes32 domain1 = "dom1";
    // bytes32 domain2 = "dom2";
    // address gateway1 = address(111);
    // address gateway2 = address(222);
    // assertTrue(_tryFile("gateway", domain1, gateway1));
    // assertTrue(_tryFile("gateway", domain2, gateway2));
    // assertEq(router.gateways(domain1), gateway1);
    // assertEq(router.gateways(domain2), gateway2);
    // assertEq(router.numDomains(), 2);
    // assertEq(router.domainAt(0), domain1);
    // assertEq(router.domainAt(1), domain2);
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
    // assertTrue(_tryFile('gateway', domain1, address(0)));

    // assertEq(router.gateways(domain1), address(0));
    // assertEq(router.gateways(domain2), gateway2);
    // assertEq(router.numDomains(), 1);
    // assertEq(router.domainAt(0), domain2);
    expect(await _tryFile('gateway', 0, domain1)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(0n);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain2));

    // Re-add removed domain
    // assertTrue(_tryFile('gateway', domain1, gateway1));

    // assertEq(router.gateways(domain1), gateway1);
    // assertEq(router.gateways(domain2), gateway2);
    // assertEq(router.numDomains(), 2);
    // assertEq(router.domainAt(0), domain2); // domains have been swapped compared to initial state
    // assertEq(router.domainAt(1), domain1);
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;

    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(2n);
    // domains have been swapped compared to initial state
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain2));
    expect((await router.call('domainAt', { index: 2n })).res).to.be.equal(BigInt(domain1));
  });

  it('test file two domains same gateway', async () => {
    // bytes32 domain1 = "dom1";
    // bytes32 domain2 = "dom2";
    // address gateway1 = address(111);
    // assertTrue(_tryFile("gateway", domain1, gateway1));
    // assertTrue(_tryFile("gateway", domain2, gateway1));
    // assertEq(router.gateways(domain1), gateway1);
    // assertEq(router.gateways(domain2), gateway1);
    // assertEq(router.numDomains(), 2);
    // assertEq(router.domainAt(0), domain1);
    // assertEq(router.domainAt(1), domain2);
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
    // bytes32 domain1 = "dom1";
    //     bytes32 domain2 = "dom2";
    //     address gateway1 = address(111);
    //     assertTrue(_tryFile("gateway", domain1, gateway1));
    //     assertTrue(_tryFile("gateway", domain2, gateway1));
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    // assertTrue(_tryFile('gateway', domain2, address(0)));
    expect(await _tryFile('gateway', 0n, domain2)).to.be.true;

    // assertEq(router.gateways(domain1), gateway1);
    // assertEq(router.gateways(domain2), address(0));
    // assertEq(router.numDomains(), 1);
    // assertEq(router.domainAt(0), domain1);
    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(0n);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));
  });

  it('test file two domains same gateway remove 2', async () => {
    //  bytes32 domain1 = "dom1";
    //     bytes32 domain2 = "dom2";
    //     address gateway1 = address(111);
    //     assertTrue(_tryFile("gateway", domain1, gateway1));
    //     assertTrue(_tryFile("gateway", domain2, gateway1));
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    // assertTrue(_tryFile('gateway', domain1, address(0)));
    // assertTrue(_tryFile('gateway', domain2, address(0)));
    expect(await _tryFile('gateway', 0n, domain1)).to.be.true;
    expect(await _tryFile('gateway', 0n, domain2)).to.be.true;

    // assertEq(router.gateways(domain1), address(0));
    // assertEq(router.gateways(domain2), address(0));
    // assertEq(router.numDomains(), 0);
    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(0n);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(0n);
    expect((await router.call('numDomains')).res).to.be.equal(0n);
  });

  it('test file two domains same gateway split', async () => {
    // bytes32 domain1 = "dom1";
    //     bytes32 domain2 = "dom2";
    //     address gateway1 = address(111);
    //     address gateway2 = address(222);
    //     assertTrue(_tryFile("gateway", domain1, gateway1));
    //     assertTrue(_tryFile("gateway", domain2, gateway1));
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    const gateway2 = 222n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    // assertTrue(_tryFile("gateway", domain2, gateway2));
    expect(await _tryFile('gateway', gateway2, domain2)).to.be.true;

    // assertEq(router.gateways(domain1), gateway1);
    // assertEq(router.gateways(domain2), gateway2);
    // assertEq(router.numDomains(), 2);
    // assertEq(router.domainAt(0), domain1);
    // assertEq(router.domainAt(1), domain2);
    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(gateway1);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(2n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain1));
    expect((await router.call('domainAt', { index: 2n })).res).to.be.equal(BigInt(domain2));
  });

  it('test file two domains same gateway split remove', async () => {
    // bytes32 domain1 = "dom1";
    //     bytes32 domain2 = "dom2";
    //     address gateway1 = address(111);
    //     address gateway2 = address(222);
    //     assertTrue(_tryFile("gateway", domain1, gateway1));
    //     assertTrue(_tryFile("gateway", domain2, gateway1));
    const domain1 = l2String('dom1');
    const domain2 = l2String('dom2');
    const gateway1 = 111n;
    const gateway2 = 222n;
    expect(await _tryFile('gateway', gateway1, domain1)).to.be.true;
    expect(await _tryFile('gateway', gateway1, domain2)).to.be.true;

    // assertTrue(_tryFile('gateway', domain2, gateway2));
    // assertTrue(_tryFile('gateway', domain1, address(0)));
    expect(await _tryFile('gateway', gateway2, domain2)).to.be.true;
    expect(await _tryFile('gateway', 0n, domain1)).to.be.true;

    //  assertEq(router.gateways(domain1), address(0));
    //  assertEq(router.gateways(domain2), gateway2);
    //  assertEq(router.numDomains(), 1);
    //  assertEq(router.domainAt(0), domain2);
    expect((await router.call('gateways', { domain: domain1 })).res).to.be.equal(0n);
    expect((await router.call('gateways', { domain: domain2 })).res).to.be.equal(gateway2);
    expect((await router.call('numDomains')).res).to.be.equal(1n);
    expect((await router.call('domainAt', { index: 1n })).res).to.be.equal(BigInt(domain2));
  });

  it('test file', async () => {
    // assertEq(router.fdust(), 0);
    // assertTrue(_tryFile('fdust', 888));
    // assertEq(router.fdust(), 888);
    expect(await router.call('fdust')).to.deep.equal(l2Eth(0n));
    expect(await _tryFile('fdust', l2Eth(888n).res)).to.be.true;
    expect(await router.call('fdust')).to.deep.equal(l2Eth(888n));
  });

  it('test file invalid what', async () => {
    // assertTrue(!_tryFile('meh', 'aaa', address(888)));
    // assertTrue(!_tryFile('meh', address(888)));
    expect(await _tryFile('meh', TEST_ADDRESS, l2String('aaa'))).to.be.false;
    expect(await _tryFile('meh', TEST_ADDRESS)).to.be.false;
  });

  it('test file fails when not authed', async () => {
    // router.deny(address(this));
    // assertTrue(!_tryFile('gateway', 'dom', address(888)));
    // assertTrue(!_tryFile('fdust', 1));
    await invoke(admin, router, 'deny', { usr: _admin });
    expect(await _tryFile('gateway', TEST_ADDRESS, l2String('dom'))).to.be.false;
    expect(await _tryFile('fdust', 1n)).to.be.false;
  });

  it('test fail register mint from not gateway', async () => {
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: domain,
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(234)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    //     router.file("gateway", "l2network", address(555));

    //     router.registerMint(guid);
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

  it('test register mint targeting actual domain', async () => {
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: domain,
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(234)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    //     router.file("gateway", "l2network", address(this));
    //     router.file("gateway", domain, teleportJoin);
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
    // router.registerMint(guid);
    await admin.invoke(router, 'registerMint', { teleportGUID: guid });
  });

  it('test register mint targeting sub domain', async () => {
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "another-l2network",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(234)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    //     router.file("gateway", "l2network", address(this));
    //     router.file("gateway", "another-l2network", address(new GatewayMock()));
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
    // router.registerMint(guid);
    await admin.invoke(router, 'registerMint', { teleportGUID: guid });
  });

  it('test fail register mint targeting invalid domain', async () => {
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "invalid-network",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(234)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    //     router.file("gateway", "l2network", address(this));
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
      //  router.registerMint(guid);
      await admin.invoke(router, 'registerMint', { teleportGUID: guid });
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/unsupported-target-domain');
    }
  });

  it('test register mint from parent gateway', async () => {
    // TeleportGUID memory guid = TeleportGUID({
    //         sourceDomain: "l2network",
    //         targetDomain: "another-l2network",
    //         receiver: addressToBytes32(address(123)),
    //         operator: addressToBytes32(address(234)),
    //         amount: 250_000 ether,
    //         nonce: 5,
    //         timestamp: uint48(block.timestamp)
    //     });
    //     router.file("gateway", parentDomain, address(this));
    //     router.file("gateway", "another-l2network", address(new GatewayMock()));
    const guid = {
      source_domain: l2String('l2network'),
      target_domain: l2String('another-l2network'),
      receiver: 123n,
      operator: 234n,
      amount: l2Eth(eth('250000')).res,
      nonce: 5,
      timestamp: new Date().getTime() * 1000,
    };

    await _tryFile('gateway', _admin, PARENT_DOMAIN);
    const _gateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', _gateway.address, l2String('another-l2network'));
    // router.registerMint(guid);
    await admin.invoke(router, 'registerMint', { teleportGUID: guid });
  });

  it('test fail settle from not gateway', async () => {
    // router.file("gateway", "l2network", address(555));
    //     DaiMock(dai).mint(address(this), 100 ether);
    //     DaiMock(dai).approve(address(router), 100 ether);
    await _tryFile('gateway', 555n, l2String('l2network'));
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });

    try {
      // router.settle("l2network", domain, 100 ether);
      await settle(l2String('l2network'), l1Domain, l2Eth(eth('100')).res);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/sender-not-gateway');
    }
  });

  it('test settle targeting actual domain', async () => {
    // router.file("gateway", "l2network", address(this));
    //     router.file("gateway", domain, teleportJoin);
    //     DaiMock(dai).mint(address(this), 100 ether);
    //     DaiMock(dai).approve(address(router), 100 ether);
    await _tryFile('gateway', _admin, l2String('l2network'));
    await _tryFile('gateway', teleportJoin, l1Domain);
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });
    // router.settle("l2network", domain, 100 ether);
    await settle(l2String('l2network'), l1Domain, l2Eth(eth('100')).res);
  });

  it('test settle targeting sub domain', async () => {
    // router.file("gateway", "l2network", address(this));
    //     router.file("gateway", "another-l2network", address(new GatewayMock()));
    //     DaiMock(dai).mint(address(this), 100 ether);
    //     DaiMock(dai).approve(address(router), 100 ether);
    await _tryFile('gateway', _admin, l2String('l2network'));
    const _gateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', _gateway.address, l2String('another-l2network'));
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });
    // router.settle("l2network", "another-l2network", 100 ether);
    await settle(l2String('l2network'), l2String('another-l2network'), l2Eth(eth('100')).res);
  });

  it('test settle from parent gateway', async () => {
    // router.file("gateway", parentDomain, address(this));
    //     router.file("gateway", "another-l2network", address(new GatewayMock()));
    //     DaiMock(dai).mint(address(this), 100 ether);
    //     DaiMock(dai).approve(address(router), 100 ether);
    await _tryFile('gateway', _admin, PARENT_DOMAIN);
    const _gateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', _gateway.address, l2String('another-l2network'));
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100')).res });
    await invoke(admin, dai, 'approve', { spender: router.address, amount: l2Eth(eth('100')).res });
    // router.settle("l2network", "another-l2network", 100 ether);
    await settle(l2String('l2network'), l2String('another-l2network'), l2Eth(eth('100')).res);
  });

  it('test fail settle targeting invalid domain', async () => {
    // router.file('gateway', 'l2network', address(this));
    await _tryFile('gateway', _admin, l2String('l2network'));

    try {
      // router.settle("l2network", "invalid-network", 100 ether);
      await settle(l2String('l2network'), l2String('invalid-network'), l2Eth(eth('100')).res);
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/unsupported-target-domain');
    }
  });

  it('test initiate teleport', async () => {
    // address parentGateway = address(new GatewayMock());
    //     router.file("gateway", parentDomain, parentGateway);
    //     DaiMock(dai).mint(address(this), 100_000 ether);
    //     DaiMock(dai).approve(address(router), 100_000 ether);
    const parentGateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', parentGateway.address, PARENT_DOMAIN);
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: router.address,
      amount: l2Eth(eth('100000')).res,
    });
    // assertEq(DaiMock(dai).balanceOf(address(this)), 100_000 ether);
    //     assertEq(DaiMock(dai).balanceOf(address(router)), 0);
    //     assertEq(router.batches(parentDomain), 0);
    //     assertEq(router.nonce(), 0);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(eth('100000')));
    expect(await dai.call('balanceOf', { user: router.address })).to.deep.equal(l2Eth(0n));
    expect(await router.call('batches', { domain: PARENT_DOMAIN })).to.deep.equal(l2Eth(0n));
    expect((await router.call('nonce')).res).to.be.equal(0n);

    // router.initiateTeleport(parentDomain, address(123), 100_000 ether);
    await initiateTeleport(PARENT_DOMAIN, 123n, eth('100000').toString());

    // assertEq(DaiMock(dai).balanceOf(address(this)), 0);
    //     assertEq(DaiMock(dai).balanceOf(address(router)), 100_000 ether);
    //     assertEq(router.batches(parentDomain), 100_000 ether);
    //     assertEq(router.nonce(), 1);
    expect(await dai.call('balanceOf', { user: _admin })).to.deep.equal(l2Eth(0n));
    expect(await dai.call('balanceOf', { user: router.address })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect(await router.call('batches', { domain: PARENT_DOMAIN })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect((await router.call('nonce')).res).to.be.equal(1n);
  });

  it('test flush', async () => {
    // address parentGateway = address(new GatewayMock());
    //     router.file("gateway", parentDomain, parentGateway);
    //     DaiMock(dai).mint(address(this), 100_000 ether);
    //     DaiMock(dai).approve(address(router), 100_000 ether);
    //     router.initiateTeleport(parentDomain, address(123), 100_000 ether);
    const parentGateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', parentGateway.address, PARENT_DOMAIN);
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: router.address,
      amount: l2Eth(eth('100000')).res,
    });
    await initiateTeleport(PARENT_DOMAIN, 123n, eth('100000').toString());

    // assertEq(router.batches(parentDomain), 100_000 ether);
    //     assertEq(DaiMock(dai).balanceOf(address(router)), 100_000 ether);
    //     assertEq(DaiMock(dai).balanceOf(parentGateway), 0);
    expect(await router.call('batches', { domain: PARENT_DOMAIN })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect(await dai.call('balanceOf', { user: parentGateway.address })).to.deep.equal(l2Eth(0n));
    expect(await dai.call('balanceOf', { user: router.address })).to.deep.equal(
      l2Eth(eth('100000'))
    );

    //     router.flush(parentDomain);
    await invoke(admin, router, 'flush', { target_domain: PARENT_DOMAIN });

    //     assertEq(router.batches(parentDomain), 0);
    //     assertEq(DaiMock(dai).balanceOf(address(router)), 0);
    //     assertEq(DaiMock(dai).balanceOf(parentGateway), 100_000 ether);
    expect(await router.call('batches', { domain: PARENT_DOMAIN })).to.deep.equal(l2Eth(0n));
    expect(await dai.call('balanceOf', { user: parentGateway.address })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect(await dai.call('balanceOf', { user: router.address })).to.deep.equal(l2Eth(0n));
  });

  it('test fail flush dust', async () => {
    // address parentGateway = address(new GatewayMock());
    //     router.file("gateway", parentDomain, parentGateway);
    //     DaiMock(dai).mint(address(this), 100_000 ether);
    //     DaiMock(dai).approve(address(router), 100_000 ether);
    //     router.initiateTeleport(parentDomain, address(123), 100_000 ether);
    const parentGateway = await simpleDeployL2('mock_gateway', {}, hre);
    await _tryFile('gateway', parentGateway.address, PARENT_DOMAIN);
    await invoke(admin, dai, 'mint', { account: _admin, amount: l2Eth(eth('100000')).res });
    await invoke(admin, dai, 'approve', {
      spender: router.address,
      amount: l2Eth(eth('100000')).res,
    });
    await initiateTeleport(PARENT_DOMAIN, 123n, eth('100000').toString());

    //     assertEq(router.batches(parentDomain), 100_000 ether);
    //     assertEq(DaiMock(dai).balanceOf(address(router)), 100_000 ether);
    //     assertEq(DaiMock(dai).balanceOf(parentGateway), 0);
    expect(await router.call('batches', { domain: PARENT_DOMAIN })).to.deep.equal(
      l2Eth(eth('100000'))
    );
    expect(await dai.call('balanceOf', { user: parentGateway.address })).to.deep.equal(l2Eth(0n));
    expect(await dai.call('balanceOf', { user: router.address })).to.deep.equal(
      l2Eth(eth('100000'))
    );

    //     router.file("fdust", 200_000 ether);
    await _tryFile('fdust', l2Eth(eth('200000')).res);
    //     router.flush(parentDomain);
    try {
      await invoke(admin, router, 'flush', { target_domain: PARENT_DOMAIN });
    } catch (err: any) {
      expect(err.message).to.contain('TeleportRouter/flush-dust');
    }
  });
});
