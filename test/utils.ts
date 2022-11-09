import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { Account, StarknetContract } from 'hardhat/types';
import isWsl from 'is-wsl';
import { validateAndParseAddress } from 'starknet';

export type SplitUintType<T> = { low: T; high: T };
type numberish = string | number | bigint | BigNumber;

const TEST_ADDRESS = '9379074284324409537785911406195';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

export const MAX_UINT = { low: 2n ** 128n - 1n, high: 2n ** 128n - 1n };

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
    return BigInt(`0x${_a[1].toString(16)}${_a[0].toString(16)}`);
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
  name: string,
  args: object,
  hre: any
): Promise<StarknetContract> {
  const factory = await hre.starknet.getContractFactory(name);
  return factory.deploy(args);
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

export function ray(a: bigint): SplitUintType<bigint> {
  const _a = l2Eth(a * RAY);
  return { low: BigInt(_a.toDec()[0]), high: BigInt(_a.toDec()[1]) };
}

export function rad(a: bigint): SplitUintType<bigint> {
  const _a = l2Eth(a * RAD);
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
