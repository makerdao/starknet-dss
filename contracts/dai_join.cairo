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

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.starknet.common.syscalls import get_contract_address, get_caller_address
from starkware.cairo.common.uint256 import Uint256, split_64
from safe_math import mul
from assertions import check

// Based on: https://github.com/makerdao/xdomain-dss/blob/f447e779576942cf983c00ee8b9dafa937d2427f/src/DaiJoin.sol

// interface DaiLike {
//     function burn(address,uint256) external;
//     function mint(address,uint256) external;
// }
@contract_interface
namespace DaiLike {
    func burn(src: felt, value: Uint256) {
    }

    func mint(dst: felt, value: Uint256) {
    }
}

// interface VatLike {
//     function move(address,address,uint256) external;
// }
@contract_interface
namespace VatLike {
    func move(src: felt, dst: felt, rad: Uint256) {
    }
}

// VatLike public immutable vat;       // CDP Engine
@storage_var
func _vat() -> (res: felt) {
}

// DaiLike public immutable dai;       // Stablecoin Token
@storage_var
func _dai() -> (res: felt) {
}

// uint256 constant RAY = 10 ** 27;
const RAY = 10 ** 27;

// event Join(address indexed usr, uint256 wad);
@event
func Join(usr: felt, wad: Uint256) {
}

// event Exit(address indexed usr, uint256 wad);
@event
func Exit(usr: felt, wad: Uint256) {
}

@view
func vat{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _vat.read();
    return (res,);
}

@view
func dai{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _dai.read();
    return (res,);
}

// constructor(address vat_, address dai_) public {
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    vat: felt, dai: felt
) {
    // vat = VatLike(vat_);
    // dai = DaiLike(dai_);
    _vat.write(vat);
    _dai.write(dai);
    return ();
}

// function join(address usr, uint256 wad) external
@external
func join{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    usr: felt, wad: Uint256
) {
    check(wad);

    let (contract_address) = get_contract_address();
    let (caller) = get_caller_address();

    let (vat) = _vat.read();
    let (dai) = _dai.read();

    // vat.move(address(this), usr, RAY * wad);
    let (value) = mul(Uint256(RAY, 0), wad);
    VatLike.move(vat, contract_address, usr, value);

    // dai.burn(msg.sender, wad);
    DaiLike.burn(dai, caller, wad);

    // emit Join(usr, wad);
    Join.emit(usr, wad);

    return ();
}

// function exit(address usr, uint256 wad) external
@external
func exit{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    usr: felt, wad: Uint256
) {
    check(wad);

    let (vat) = _vat.read();
    let (dai) = _dai.read();

    let (contract_address) = get_contract_address();
    let (caller) = get_caller_address();

    // vat.move(msg.sender, address(this), RAY * wad);
    let (value) = mul(Uint256(RAY, 0), wad);
    VatLike.move(vat, caller, contract_address, value);

    // dai.mint(usr, wad);
    DaiLike.mint(dai, usr, wad);

    // emit Exit(usr, wad);
    Exit.emit(usr, wad);

    return ();
}
