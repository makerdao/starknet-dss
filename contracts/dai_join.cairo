# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2021 Dai Foundation
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

%lang starknet

from starkware.starknet.common.syscalls import (get_contract_address)
from starkware.cairo.common.uint256 import (Uint256, uint256_mul, split_64)

@contract_interface
namespace IDAI:
  func burn(from_address : felt, value : Uint256):
  end

  func mint(to_address : felt, value : Uint256):
  end
end

@contract_interface
namespace IVat:
  func move(from_address : felt, to_address : felt, rad : Uint256):
  end
end


@event
func Join(user : felt, wad : Uint256):
end

@event
func Exit(user : felt, wad : Uint256):
end


@storage_var
func _vat() -> (res : felt):
end

@storage_var
func _dai() -> (res : felt):
end

const RAY = Uint256(high=0, low=10 ** 27)


@constructor
func constructor{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(
    vat : felt,
    dai : felt
  ):
    _vat.write(vat)
    _dai.write(dai)
end


@external
func join{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(user : felt, wad : Uint256):
    let (vat) = _vat.read()
    let (dai) = _dai.read()

    let (contract_address) = get_contract_address()
    let (caller) = get_caller_address()

    let (value) = uint256_mul(RAY, wad)

    IVat(vat).move(contract_address, user, value)
    IDAI(dai).burn(caller, wad)

    Join.emit(user, wad)

    return ()
end

@external
func exit{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(user : felt, wad : Uint256):
    let (vat) = _vat.read()
    let (dai) = _dai.read()

    let (contract_address) = get_contract_address()
    let (caller) = get_caller_address()

    let (value) = uint256_mul(RAY, wad)

    IVat(vat).move(caller, contract_address, value)
    IDAI(dai).mint(urs, wad)

    Join.emit(user, wad)

    return ()
end
