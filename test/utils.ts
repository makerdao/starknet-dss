import { OpenZeppelinAccount } from '@shardlabs/starknet-hardhat-plugin/dist/src/account';
import { PredeployedAccount } from '@shardlabs/starknet-hardhat-plugin/dist/src/devnet-utils';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { starknet } from 'hardhat';
import { Account, StarknetContract, TransactionReceipt } from 'hardhat/types';
import isWsl from 'is-wsl';
import { validateAndParseAddress } from 'starknet';
import { getSelectorFromName } from 'starknet/dist/utils/hash';

export type SplitUintType<T> = { low: T; high: T };
type numberish = string | number | bigint | BigNumber;

const TEST_ADDRESS = '9379074284324409537785911406195';

export const WAD = 10n ** 18n;
export const RAY = 10n ** 27n;
export const RAD = 10n ** 45n;

export const MAX_UINT = { low: 2n ** 128n - 1n, high: 2n ** 128n - 1n };

export const DAY = 86400;

export function l2String(str: string): string {
  return `0x${Buffer.from(str, 'utf8').toString('hex')}`;
}

const DOCKER_HOST = 'host.docker.internal';
const MACOS_PLATFORM = 'darwin';
/**
 * Adapts `url` by replacing localhost and 127.0.0.1 with `host.internal.docker`
 * @param url string representing the url to be adapted
 * @returns adapted url
 */
export function adaptUrl(url: string): string {
  if (process.platform === MACOS_PLATFORM || isWsl) {
    for (const protocol of ['http://', 'https://', '']) {
      for (const host of ['localhost', '127.0.0.1']) {
        if (url === `${protocol}${host}`) {
          return `${protocol}${DOCKER_HOST}`;
        }

        const prefix = `${protocol}${host}:`;
        if (url.startsWith(prefix)) {
          return url.replace(prefix, `${protocol}${DOCKER_HOST}:`);
        }
      }
    }
  }

  return url;
}

export function l2Address(address: string | number | bigint | BigNumber) {
  return validateAndParseAddress(`0x${asHex(address)}`);
}

export class SplitUint {
  res: SplitUintType<bigint>;

  constructor(res: SplitUintType<bigint>) {
    this.res = res;
  }

  static fromUint(a: numberish): SplitUint {
    const bits = asHex(a).padStart(64, '0');
    const res = {
      low: BigInt(`0x${bits.slice(32)}`),
      high: BigInt(`0x${bits.slice(0, 32)}`),
    };
    return new SplitUint(res);
  }

  toArray(): bigint[] {
    return Object.values(this.res);
  }

  toUint(): bigint {
    const _a = this.toArray();
    return _a[0] + 2n ** 128n * _a[1];
  }

  add(_a: SplitUint | numberish): SplitUint {
    let a = _a as SplitUint;
    if (!_a.hasOwnProperty('res')) {
      a = SplitUint.fromUint(_a as numberish);
    }
    return SplitUint.fromUint(this.toUint() + a.toUint());
  }

  sub(_a: SplitUint | numberish): SplitUint {
    let a = _a as SplitUint;
    if (!_a.hasOwnProperty('res')) {
      a = SplitUint.fromUint(_a as numberish);
    }
    return SplitUint.fromUint(this.toUint() - a.toUint());
  }

  toDec(): string[] {
    return this.toArray().map(asDec);
  }
}

function asHex(a: string | number | bigint | BigNumber): string {
  return BigNumber.isBigNumber(a) ? a.toHexString().slice(2) : BigInt(a).toString(16);
}

export function split(a: BigNumber): bigint[] {
  return SplitUint.fromUint(a).toArray();
}

export function toBytes32(a: string): string {
  return `0x${BigInt(a).toString(16).padStart(64, '0')}`;
}

export function eth(amount: string) {
  return parseEther(amount);
}

export function l2Eth(amount: string | number | bigint | BigNumber): SplitUint {
  return SplitUint.fromUint(`0x${asHex(amount)}`);
}

export function asDec(a: string | number | bigint): string {
  return BigInt(a).toString();
}

export async function simpleDeployL2(
  account: Account,
  name: string,
  args: object,
  hre: any
): Promise<StarknetContract> {
  const factory = await hre.starknet.getContractFactory(name);
  await account.declare(factory);
  return await account.deploy(factory, args);
}

export async function useDevnetAccount(
  index: number
): Promise<{ account: OpenZeppelinAccount; address: string }> {
  const devnetAccounts: PredeployedAccount[] = await starknet.devnet.getPredeployedAccounts();
  const address = devnetAccounts[index].address;
  const private_key = devnetAccounts[index].private_key;
  const account = await starknet.OpenZeppelinAccount.getAccountFromAddress(address, private_key);
  return { account, address };
}

export async function invoke(
  user: Account,
  contract: StarknetContract,
  selector: string,
  data?: any
) {
  return user.invoke(contract, selector, data);
}

export async function checkAuth(base: any, contractName: string, admin: Account) {
  const { res: ward } = await base.call('wards', { user: admin.starknetContract.address });

  // await GodMode.setWard(base.address, this, 1);

  expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

  await invoke(admin, base, 'rely', { usr: TEST_ADDRESS });

  expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(1n);

  await invoke(admin, base, 'deny', { usr: TEST_ADDRESS });

  expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

  await invoke(admin, base, 'deny', { usr: admin.starknetContract.address });

  try {
    await invoke(admin, base, 'rely', { usr: TEST_ADDRESS });
  } catch (err: any) {
    expect(err.message).to.contain(`${contractName}/not-authorized`);
  }
  try {
    await invoke(admin, base, 'deny', { usr: TEST_ADDRESS });
  } catch (err: any) {
    expect(err.message).to.contain(`${contractName}/not-authorized`);
  }

  // await GodMode.setWard(base.address, this, ward);
}

export function wad(a: bigint): SplitUintType<bigint> {
  const _a = l2Eth(a * WAD);
  return { low: BigInt(_a.toDec()[0]), high: BigInt(_a.toDec()[1]) };
}

export function ray(wad: bigint): SplitUintType<bigint> {
  const _a = l2Eth(wad * 10n ** 9n);
  return { low: BigInt(_a.toDec()[0]), high: BigInt(_a.toDec()[1]) };
}

export function rad(wad: bigint): SplitUintType<bigint> {
  const _a = l2Eth(wad * RAY);
  return { low: BigInt(_a.toDec()[0]), high: BigInt(_a.toDec()[1]) };
}

export function uint(a: bigint): SplitUintType<bigint> {
  const _a = l2Eth(a);
  return { low: BigInt(_a.toDec()[0]), high: BigInt(_a.toDec()[1]) };
}
export const logGas = async (message: string, tx: Promise<any>, skip?: boolean): Promise<any> => {
  return tx.then(async (result) => {
    const receipt = await result.wait();
    if (!skip) console.log('           Used', receipt.gasUsed.toNumber(), `gas for >${message}<`);
    return result;
  });
};

export const neg = (amount: bigint): bigint => {
  const value = ~((amount - 1n) | ~((1n << 256n) - 1n));
  return value;
};

export const blockTimestamp = async () => (await starknet.getBlock()).timestamp;

export interface IEventDataEntry {
  data: any;
  isAddress?: boolean;
}

// Asserts that the given event exists in the given receipt, with the correct event data
export const assertEvent = (
  receipt: TransactionReceipt,
  eventName: string,
  eventData: IEventDataEntry[]
) => {
  const eventKey = getSelectorFromName(eventName);
  const foundEvent = receipt.events.filter((e) => e.keys.some((a) => a == eventKey));
  if (!foundEvent || foundEvent.length != 1 || foundEvent[0].keys.length != 1) {
    expect.fail('No event ' + eventName + ' found');
  }

  expect(foundEvent[0].data.length).to.equal(eventData.length);
  for (let i = 0; i < eventData.length; i++) {
    if (eventData[i].isAddress) {
      // Addresses in events are not padded to 32 bytes by default, for some reason
      expect(ethers.utils.hexZeroPad(eventData[i].data, 32)).to.equal(
        ethers.utils.hexZeroPad(foundEvent[0].data[i], 32)
      );
    } else {
      expect(eventData[i].data).to.equal(foundEvent[0].data[i]);
    }
  }
};

export async function checkFileUint(
  base: any,
  contractName: string,
  fileFunctionName: string,
  values: string[],
  admin: Account,
  notAdmin: Account
) {
  // const { res: ward } = await base.call('wards', { user: admin.address });

  // Ensure we have admin access
  // await GodMode.setWard(base, admin.address, 1);

  // First check an invalid value
  try {
    await invoke(admin, base, fileFunctionName, {
      what: l2String('an invalid value'),
      data: {
        low: 1,
        high: 0,
      },
    });
  } catch (err: any) {
    expect(err.message).to.contain(`${contractName}/file-unrecognized-param`);
  }

  // Next check each value is valid and updates the target storage slot
  for (let i = 0; i < values.length; i++) {
    // Read original value
    const { res: _origData } = await base.call(values[i]);
    const origData = new SplitUint(_origData);
    const newData = origData.add(1);

    // Update value
    // vm.expectEmit(true, false, false, true);
    // emit File(valueB32, newData);
    await invoke(admin, base, fileFunctionName, {
      what: l2String(values[i]),
      data: {
        low: newData.toDec()[0],
        high: newData.toDec()[1],
      },
    });

    // Confirm it was updated successfully
    const { res: _data } = await base.call(values[i]);
    const data = new SplitUint(_data);
    expect(data).to.deep.equal(newData);

    // Reset value to original
    // vm.expectEmit(true, false, false, true);
    // emit File(valueB32, origData);
    await invoke(admin, base, fileFunctionName, {
      what: l2String(values[i]),
      data: {
        low: origData.toDec()[0],
        high: origData.toDec()[0],
      },
    });
  }

  // Finally check that file is authed
  // await invoke(admin, base, 'deny', { usr: admin.address });
  try {
    await invoke(notAdmin, base, fileFunctionName, {
      what: l2String('some value'),
      data: {
        low: 1,
        high: 0,
      },
    });
  } catch (err: any) {
    expect(err.message).to.contain(`${contractName}/not-authorized`);
  }

  // Reset admin access to what it was
  // GodMode.setWard(base.address, this, ward);
}

export async function checkFileAddress(
  base: any,
  contractName: string,
  fileFunctionName: string,
  values: string[],
  admin: Account,
  notAdmin: Account
) {
  // const { res: ward } = await base.call('wards', { user: admin.address });

  // Ensure we have admin access
  // await GodMode.setWard(base, admin.address, 1);

  // First check an invalid value
  try {
    await invoke(admin, base, fileFunctionName, {
      what: l2String('an invalid value'),
      data: 1n,
    });
  } catch (err: any) {
    expect(err.message).to.contain(`${contractName}/file-unrecognized-param`);
  }

  // Next check each value is valid and updates the target storage slot
  for (let i = 0; i < values.length; i++) {
    // Read original value
    const { res: _origData } = await base.call(values[i]);

    // Update value
    const newData = 123456789n;
    // vm.expectEmit(true, false, false, true);
    // emit File(valueB32, newData);
    await invoke(admin, base, fileFunctionName, {
      what: l2String(values[i]),
      data: newData,
    });

    // Confirm it was updated successfully
    const { res: _data } = await base.call(values[i]);
    expect(_data).to.equal(newData);

    // Reset value to original
    // vm.expectEmit(true, false, false, true);
    // emit File(valueB32, origData);
    await invoke(admin, base, fileFunctionName, {
      what: l2String(values[i]),
      data: _origData,
    });
  }

  // Finally check that file is authed
  // await invoke(admin, base, 'deny', { usr: admin.address });
  try {
    await invoke(notAdmin, base, fileFunctionName, {
      what: l2String('some value'),
      data: 1n,
    });
  } catch (err: any) {
    expect(err.message).to.contain(`${contractName}/not-authorized`);
  }

  // Reset admin access to what it was
  // GodMode.setWard(base.address, this, ward);
}
