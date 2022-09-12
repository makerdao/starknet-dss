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
  let admin: any;
  let _admin: string;
  let user1: any;
  let _user1: string;
  let user2: any;
  let _user2: any;
  let teleportJoin: any;
  let teleportRouter: any;
  let vat: any;
  let daiJoin: any;
  let dai: any;

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
        vat_: vat.starknetContract.address,
        dai_: dai.starknetContract.address,
      },
      hre
    );

    teleportRouter = await simpleDeployL2('mock_gateway', {}, hre);

    teleportJoin = await simpleDeployL2(
      'teleport_join',
      {
        ward: _admin,
        vat_: vat.starknetContract.address,
        daiJoin_: daiJoin.starknetContract.address,
        ilk_: ILK,
        domain_: VALID_DOMAINS,
        router_: teleportRouter.starknetContract.address,
      },
      hre
    );

    await starknet.devnet.dump('unittest-dump.dmp');
    await sleep(5000);
  });

  beforeEach(async () => {
    await starknet.devnet.load('unittest-dump.dmp');
  });
});
