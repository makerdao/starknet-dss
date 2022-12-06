// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// https://github.com/makerdao/xdomain-dss/blob/add-end/src/GemJoin.sol
// #commit#1f34bf2ae4914356b926a24462aa9a643b4a10d6

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.starknet.common.syscalls import get_contract_address, get_caller_address
from starkware.cairo.common.math import assert_le
from starkware.cairo.common.uint256 import Uint256, uint256_le, uint256_neg

from contracts.starknet.assertions import _ge_0, check

// Based on: https://github.com/makerdao/xdomain-dss/blob/f447e779576942cf983c00ee8b9dafa937d2427f/src/GemJoin.sol

// interface GemLike {
//     function decimals() external view returns (uint256);
//     function transfer(address,uint256) external returns (bool);
//     function transferFrom(address,address,uint256) external returns (bool);
// }
@contract_interface
namespace GemLike {
    func decimals() -> (res: felt) {
    }

    func transfer(to_address: felt, value: Uint256) -> (res: felt) {
    }

    func transferFrom(from_address: felt, to_address: felt, value: Uint256) -> (res: felt) {
    }
}

// interface VatLike {
//     function slip(bytes32,address,int256) external;
// }
@contract_interface
namespace VatLike {
    func slip(ilk: felt, usr: felt, wad: Uint256) {
    }
}

// uint256 public live;  // Active Flag
@storage_var
func _live() -> (res: felt) {
}

// mapping (address => uint256) public wards;
@storage_var
func _wards(user: felt) -> (res: felt) {
}

// VatLike public vat;   // CDP Engine
// bytes32 public ilk;   // Collateral Type
// GemLike public gem;
// uint    public dec;
@storage_var
func _vat() -> (res: felt) {
}
@storage_var
func _ilk() -> (res: felt) {
}
@storage_var
func _gem() -> (res: felt) {
}
@storage_var
func _dec() -> (res: felt) {
}

// event Rely(address indexed usr);
// event Deny(address indexed usr);
// event Cage();
// event Join(address indexed usr, uint256 wad);
// event Exit(address indexed usr, uint256 wad);
@event
func Rely(user: felt) {
}
@event
func Deny(user: felt) {
}
@event
func Cage() {
}
@event
func Join(user: felt, wad: Uint256) {
}
@event
func Exit(user: felt, wad: Uint256) {
}

// modifier auth {
//     require(wards[msg.sender] == 1, "GemJoin/not-authorized");
//     _;
// }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (ward) = _wards.read(caller);
    with_attr error_message("GemJoin/not-authorized") {
        assert ward = 1;
    }
    return ();
}

// constructor(address vat_, bytes32 ilk_, address gem_) public {
//     wards[msg.sender] = 1;
//     live = 1;
//     vat = VatLike(vat_);
//     ilk = ilk_;
//     gem = GemLike(gem_);
//     dec = gem.decimals();
//     emit Rely(msg.sender);
// }
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    vat: felt, ilk: felt, gem: felt, ward: felt
) {
    _wards.write(ward, 1);
    _live.write(1);
    _vat.write(vat);
    _ilk.write(ilk);
    _gem.write(gem);
    let (dec) = GemLike.decimals(gem);
    _dec.write(dec);
    Rely.emit(ward);
    return ();
}

// // --- Administration ---
// function rely(address usr) external auth {
//     wards[usr] = 1;
//     emit Rely(usr);
// }
// function deny(address usr) external auth {
//     wards[usr] = 0;
//     emit Deny(usr);
// }
// modifier auth {
//     require(wards[msg.sender] == 1, "GemJoin/not-authorized");
//     _;
// }
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();
    _wards.write(usr, 1);
    Rely.emit(usr);
    return ();
}
@external
func deny{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();
    _wards.write(usr, 0);
    Deny.emit(usr);
    return ();
}

// function cage() external auth {
//     live = 0;
//     emit Cage();
// }
@external
func cage{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    auth();
    _live.write(0);
    Cage.emit();
    return ();
}

// function join(address usr, uint256 wad) external {
@external
func join{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    user: felt, wad: Uint256
) {
    alloc_locals;

    check(wad);

    let (caller) = get_caller_address();
    let (contract_address) = get_contract_address();

    // require(live == 1, "GemJoin/not-live");
    let (live) = _live.read();
    with_attr error_message("GemJoin/not-live") {
        assert live = 1;
    }

    // require(int(wad) >= 0, "GemJoin/overflow");
    local syscall_ptr: felt* = syscall_ptr;
    let (res) = _ge_0(wad);
    with_attr error_message("GemJoin/overflow") {
        assert res = 1;
    }

    // vat.slip(ilk, usr, int256(wad));
    let (vat) = _vat.read();
    let (gem) = _gem.read();
    let (ilk) = _ilk.read();
    VatLike.slip(vat, ilk, user, wad);

    // require(gem.transferFrom(msg.sender, address(this), wad), "GemJoin/failed-transfer");
    with_attr error_message("GemJoin/failed-transfer") {
        let (res) = GemLike.transferFrom(gem, caller, contract_address, wad);
        assert res = 1;
    }

    // emit Join(usr, wad);
    Join.emit(user, wad);

    return ();
}

// function exit(address usr, uint256 wad) external {
@external
func exit{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    user: felt, wad: Uint256
) {
    // require(wad <= 2 ** 255, "GemJoin/overflow");
    with_attr error_message("GemJoin/overflow") {
        _ge_0(wad);
    }

    let (vat) = _vat.read();
    let (ilk) = _ilk.read();
    let (gem) = _gem.read();
    let (minus_wad) = uint256_neg(wad);
    let (caller) = get_caller_address();
    // vat.slip(ilk, msg.sender, -int(wad));
    VatLike.slip(vat, ilk, caller, minus_wad);

    // require(gem.transfer(usr, wad), "GemJoin/failed-transfer");
    with_attr error_message("GemJoin/failed-transfer") {
        let (res) = GemLike.transfer(gem, user, wad);
        assert res = 1;
    }

    // emit Exit(usr, wad);
    Exit.emit(user, wad);

    return ();
}
