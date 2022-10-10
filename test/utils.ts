import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { StarknetContract, Account } from 'hardhat/types';
import { validateAndParseAddress } from 'starknet';

type SplitUintType = { low: bigint; high: bigint };
type numberish = string | number | bigint | BigNumber;

export function l2String(str: string): string {
  return `0x${Buffer.from(str, 'utf8').toString('hex')}`;
}

export class SplitUint {
  res: SplitUintType;

  constructor(res: SplitUintType) {
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

export function asHex(a: string | number | bigint | BigNumber): string {
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

export function l2Address(address: string | number | bigint | BigNumber) {
  return validateAndParseAddress(`0x${asHex(address)}`);
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
