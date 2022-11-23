// // SPDX-License-Identifier: AGPL-3.0-or-later

// /// Jug.sol -- Dai Lending Rate

// // Copyright (C) 2018 Rain <rainbreak@riseup.net>
// // Copyright (C) 2022 Dai Foundation
// //
// // This program is free software: you can redistribute it and/or modify
// // it under the terms of the GNU Affero General Public License as published by
// // the Free Software Foundation, either version 3 of the License, or
// // (at your option) any later version.
// //
// // This program is distributed in the hope that it will be useful,
// // but WITHOUT ANY WARRANTY; without even the implied warranty of
// // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// // GNU Affero General Public License for more details.
// //
// // You should have received a copy of the GNU Affero General Public License
// // along with this program.  If not, see <https://www.gnu.org/licenses/>.

// pragma solidity ^0.8.13;
%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from contracts.starknet.safe_math import Int256, add, _felt_to_uint, div_rem, mul, div, _sub
from contracts.starknet.assertions import _ge_0, assert_0
from starkware.starknet.common.syscalls import (
    get_caller_address,
    get_contract_address,
    get_block_timestamp,
)

from starkware.cairo.common.uint256 import Uint256, uint256_le, uint256_neg, uint256_eq

// interface VatLike {
//     function ilks(bytes32) external returns (
//         uint256 Art,   // [wad]
//         uint256 rate   // [ray]
//     );
//     function fold(bytes32,address,int256) external;
// }
@contract_interface
namespace VatLike {
    func ilks(ilk: felt) -> (Art: Uint256, rate: Uint256) {
    }

    func fold(i: felt, u: felt, rate: Int256) -> () {
    }
}

// contract Jug {
//     // --- Data ---
//     mapping (address => uint256) public wards;
@storage_var
func _wards(user: felt) -> (res: felt) {
}

// struct Ilk {
//         uint256 duty;  // Collateral-specific, per-second stability fee contribution [ray]
//         uint256  rho;  // Time of last drip [unix epoch time]
//     }
struct Ilk {
    duty: Uint256,
    rho: felt,
}

// mapping (bytes32 => Ilk) public ilks;
@storage_var
func _ilks(ilk: felt) -> (res: Ilk) {
}
// address                  public vow;   // Debt Engine
@storage_var
func _vow() -> (res: felt) {
}
// uint256                  public base;  // Global, per-second stability fee contribution [ray]
@storage_var
func _base() -> (res: Uint256) {
}

// VatLike public immutable vat;   // CDP Engine
@storage_var
func _vat() -> (res: felt) {
}
// uint256 constant RAY = 10 ** 27;
const RAY = 10 ** 27;

// // --- Events ---
// event Rely(address indexed usr);
@event
func Rely(usr: felt) {
}

// event Deny(address indexed usr);
@event
func Deny(usr: felt) {
}
// event Init(bytes32 indexed ilk);
@event
func Init(ilk: felt) {
}
// event File(bytes32 indexed ilk, bytes32 indexed what, uint256 data);
@event
func File_duty(ilk: felt, what: felt, data: Uint256) {
}

// event File(bytes32 indexed what, uint256 data);
@event
func File_base(what: felt, data: Uint256) {
}

// event File(bytes32 indexed what, address data);
@event
func File(what: felt, data: felt) {
}

// event Drip(bytes32 indexed ilk);
@event
func Drip(ilk: felt) {
}

// modifier auth {
//         require(wards[msg.sender] == 1, "Jug/not-authorized");
//         _;
//     }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (ward) = _wards.read(caller);
    with_attr error_message("Jug/not-authorized") {
        assert ward = 1;
    }
    return ();
}

// // --- Init ---
//     constructor(address vat_) {
//         wards[msg.sender] = 1;
//         vat = VatLike(vat_);
//         emit Rely(msg.sender);
//     }
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    vat_: felt, ward_: felt
) {
    _wards.write(ward_, 1);

    _vat.write(vat_);

    Rely.emit(ward_);

    return ();
}

// // --- Math ---
//     function _rpow(uint256 x, uint256 n, uint256 b) internal pure returns (uint256 z) {
//       assembly {
//         switch x case 0 {switch n case 0 {z := b} default {z := 0}}
//         default {
//           switch mod(n, 2) case 0 { z := b } default { z := x }
//           let half := div(b, 2)  // for rounding.
//           for { n := div(n, 2) } n { n := div(n,2) } {
//             let xx := mul(x, x)
//             if iszero(eq(div(xx, x), x)) { revert(0,0) }
//             let xxRound := add(xx, half)
//             if lt(xxRound, xx) { revert(0,0) }
//             x := div(xxRound, b)
//             if mod(n,2) {
//               let zx := mul(z, x)
//               if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
//               let zxRound := add(zx, half)
//               if lt(zxRound, zx) { revert(0,0) }
//               z := div(zxRound, b)
//             }
//           }
//         }
//       }
//     }
func _rpow{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(x: Uint256, n: Uint256, base: Uint256) -> (z: Uint256) {
    alloc_locals;
    let (is_x_null) = uint256_eq(x, Uint256(0, 0));
    let (is_n_null) = uint256_eq(n, Uint256(0, 0));

    if (is_x_null == 1) {
        if (is_n_null == 1) {
            return (z=base);
        } else {
            return (z=Uint256(0, 0));
        }
    } else {
        let (_, mod_2_n) = div_rem(n, Uint256(2, 0));
        let (is_mod_null) = uint256_eq(mod_2_n, Uint256(0, 0));
        let (_z) = internal.get_z(base, x, is_mod_null);
        let (half, _) = div_rem(base, Uint256(2, 0));
        let (init_n, _) = div_rem(n, Uint256(2, 0));
        let (end_z) = internal._loop(x, init_n, half, _z, base);
        return (z=end_z,);
    }
}

// function _int256(uint256 x) internal pure returns (int256 y) {
//         require((y = int256(x)) >= 0);
//     }
func _int256{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(x: Uint256) -> (
    y: Int256
) {
    let (pos) = _ge_0(x);
    assert pos = 1;
    return (y=x);
}

// // --- Administration ---
//     function rely(address usr) external auth {
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // wards[usr] = 1;
    _wards.write(usr, 1);

    // emit Rely(usr);
    Rely.emit(usr);

    return ();
}

// function deny(address usr) external auth {
@external
func deny{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // wards[usr] = 0;
    _wards.write(usr, 0);

    // emit Deny(usr);
    Deny.emit(usr);

    return ();
}

// function init(bytes32 ilk) external auth {
@external
func init{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ilk: felt) {
    auth();

    // Ilk storage i = ilks[ilk];
    let (i) = _ilks.read(ilk);
    // require(i.duty == 0, "Jug/ilk-already-init");
    with_attr error_message("Jug/ilk-already-init") {
        assert_0(i.duty);
    }
    // i.duty = RAY;
    // i.rho  = block.timestamp;
    let (timestamp) = get_block_timestamp();

    _ilks.write(ilk, Ilk(duty=Uint256(RAY, 0), rho=timestamp));

    // emit Init(ilk);
    Init.emit(ilk);
    return ();
}

// function file(bytes32 ilk, bytes32 what, uint256 data) external auth {
@external
func file_duty{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    ilk: felt, what: felt, data: Uint256
) {
    auth();

    let (timestamp) = get_block_timestamp();

    let (i) = _ilks.read(ilk);

    // require(block.timestamp == ilks[ilk].rho, "Jug/rho-not-updated");
    with_attr error_message("End/file-unrecognized-param") {
        assert timestamp = i.rho;
    }

    // else revert("Jug/file-unrecognized-param");
    with_attr error_message("End/file-unrecognized-param") {
        assert what = 'duty';
    }

    // if (what == "duty") ilks[ilk].duty = data;
    _ilks.write(ilk, Ilk(duty=data, rho=i.rho));

    // emit File(ilk, what, data);
    File_duty.emit(ilk, what, data);
    return ();
}

// function file(bytes32 what, uint256 data) external auth {
@external
func file_base{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    what: felt, data: Uint256
) {
    auth();

    let (timestamp) = get_block_timestamp();

    // else revert("Jug/file-unrecognized-param");
    with_attr error_message("End/file-unrecognized-param") {
        assert what = 'base';
    }

    // if (what == "base") base = data;
    _base.write(data);

    // emit File(what, data);
    File_base.emit(what, data);
    return ();
}

// function file(bytes32 what, address data) external auth {
@external
func file{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(what: felt, data: felt) {
    auth();

    // else revert("Jug/file-unrecognized-param");
    with_attr error_message("End/file-unrecognized-param") {
        assert what = 'vow';
    }

    // if (what == "vow") vow = data;
    _vow.write(data);

    // emit File(what, data);
    File.emit(what, data);
    return ();
}

// // --- Stability Fee Collection ---
//     function drip(bytes32 ilk) external returns (uint256 rate) {
@external
func drip{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(ilk: felt) -> (rate: Uint256) {
    alloc_locals;

    let (vat) = _vat.read();
    let (vow) = _vow.read();
    let (i) = _ilks.read(ilk);
    let (base) = _base.read();
    let (timestamp) = get_block_timestamp();

    // (, uint256 prev) = vat.ilks(ilk);
    let (_, prev: Uint256) = VatLike.ilks(vat, ilk);
    // rate = _rpow(base + ilks[ilk].duty, block.timestamp - ilks[ilk].rho, RAY) * prev / RAY;
    let (x) = add(base, i.duty);
    let n = timestamp - i.rho;
    let (un) = _felt_to_uint(n);
    let (rate) = _rpow(x, un, Uint256(RAY, 0));
    let (rate) = mul(rate, prev);
    let (rate) = div(rate, Uint256(RAY, 0));

    // vat.fold(ilk, vow, _int256(rate) - _int256(prev));
    let (value) = _sub(rate, prev);
    VatLike.fold(vat, ilk, vow, value);

    // ilks[ilk].rho = block.timestamp;
    _ilks.write(ilk, Ilk(duty=i.duty, rho=timestamp));

    // emit Drip(ilk);
    Drip.emit(ilk);

    return (rate=prev);
}

namespace internal {
    func _loop{
        syscall_ptr: felt*,
        pedersen_ptr: HashBuiltin*,
        range_check_ptr,
        bitwise_ptr: BitwiseBuiltin*,
    }(x: Uint256, n: Uint256, half: Uint256, z: Uint256, base: Uint256) -> (new_z: Uint256) {
        alloc_locals;
        let (stop) = uint256_eq(n, Uint256(0, 0));
        if (stop == 1) {
            return (z,);
        }

        let (xx) = mul(x, x);
        let (xxRound) = add(xx, half);
        let (new_x, _) = div_rem(xxRound, base);
        let (new_n, mod_2) = div_rem(n, Uint256(2, 0));
        let (is_odd) = uint256_eq(mod_2, Uint256(1, 0));
        // let (is_even) = bitwise_and(new_x, Uint256(0, 0))
        if (is_odd == 1) {
            let (zx) = mul(z, new_x);
            // let (is_x_positive) = uint256_lt(Uint256(0, 0), new_x)
            // let (check_overflow, _) = div_rem(zx, x)
            // let (has_not_overflow) = uint256_eq(check_overflow, z)
            // with_attr error_message("overflow"):
            //     assert and(is_x_positive, 1 - has_not_overflow) = TRUE
            // end
            let (zxRound) = add(zx, half);
            let (new_z, _) = div_rem(zxRound, base);
            return _loop(new_x, new_n, half, new_z, base);
        } else {
            return _loop(new_x, new_n, half, z, base);
        }
    }

    func get_z{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
        base: Uint256, x: Uint256, condition
    ) -> (z: Uint256) {
        if (condition == 1) {
            return (z=base);
        } else {
            return (z=x);
        }
    }
}
