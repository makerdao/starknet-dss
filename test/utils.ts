import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { Account, StarknetContract } from 'hardhat/types';
import fetch from 'node-fetch';

export type SplitUintType<T> = { low: T; high: T };
type numberish = string | number | bigint | BigNumber;

const TEST_ADDRESS = '9379074284324409537785911406195';

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

export function l2String(str: string): string {
  return `0x${Buffer.from(str, 'utf8').toString('hex')}`;
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

  await invoke(admin, base, 'rely', { user: TEST_ADDRESS });

  expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(1n);

  await invoke(admin, base, 'deny', { user: TEST_ADDRESS });

  expect((await base.call('wards', { user: TEST_ADDRESS })).res).to.equal(0n);

  await invoke(admin, base, 'deny', { user: admin.starknetContract.address });

  try {
    await invoke(admin, base, 'rely', { user: TEST_ADDRESS });
  } catch (err: any) {
    expect(err.message).to.contain(`${contractName}/not-authorized`);
  }
  try {
    await invoke(admin, base, 'deny', { user: TEST_ADDRESS });
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
