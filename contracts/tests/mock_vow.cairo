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

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256

@contract_interface
namespace VatLike {
    func Line() -> (Line: Uint256) {
    }

    func heal(rad: Uint256) {
    }
}

@storage_var
func _vat() -> (vat: felt) {
}

@storage_var
func _told() -> (told: Uint256) {
}

@view
func vat{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (vat: felt) {
    let (vat) = _vat.read();
    return (vat,);
}

@view
func told{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (told: Uint256) {
    let (told) = _told.read();
    return (told,);
}

@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(vat_: felt) {
    _vat.write(vat_);
    return ();
}

@view
func grain{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (Line: Uint256) {
    let (vat) = _vat.read();
    let (Line) = VatLike.Line(vat);
    return (Line,);
}

@external
func tell{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(value: Uint256) {
    _told.write(value);
    return ();
}

@external
func heal{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(amount: Uint256) {
    let (vat) = _vat.read();
    VatLike.heal(vat, amount);
    return ();
}
