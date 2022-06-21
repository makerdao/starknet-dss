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
namespace IGem:
  func decimals() -> (res : Uint256):
  end

  func transfer(to_address : felt, value : Uint256) -> (res: felt):
  end

  func transferFrom(from_address : felt, to_address : felt, value : Uint256) -> (res : felt):
  end
end

@contract_interface
namespace IVat:
  func slip(ilk : felt, user : felt, wad : Uint256):
  end
end


@event
func Rely(user : felt):
end

@event
func Deny(user : felt):
end

@event
func Cage():
end

@event
func Join(user : felt, wad : Uint256):
end

@event
func Exit(user : felt, wad : Uint256):
end


@storage_var
func _wards(user : felt) -> (res : felt):
end

@storage_var
func _live() -> (res : felt):
end

@storage_var
func _vat() -> (res : felt):
end

@storage_var
func _ilk() -> (res : felt):
end

@storage_var
func _gem() -> (res : felt):
end

@storage_var
func _dec() -> (res : felt):
end


func auth{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    let (caller) = get_caller_address()
    let (ward) = _wards.read(caller)
    with_attr error_message("GemJoin/not-authorized"):
      assert ward = 1
    end
    return ()
end

@external
func rely(user : felt):
    auth()
    _wards.write(user, 1)
    Rely.emit(user)
end

@external
func deny(user : felt):
    auth()
    _wards.write(user, 0)
    Deny.emit(user)
end

@external
func cage():
    auth()
    Cage.emit()
end

@constructor
func constructor{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(
    vat : felt,
    ilk : felt
    gem : felt
  ):
    let (caller) = get_caller_address()
    _wards.write(caller, 1)
    _live.write(1)
    _vat.write(vat)
    _ilk.write(ilk)
    let (dec) = IGem(gem).decimals()
    _dec.write(dec)
    Rely.emit(caller)
end


@external
func join{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(user : felt, wad : Uint256):
    let (live) = get_caller_address()
    with_attr error_message("GemJoin/not-live"):
      assert live = 1
    end

    with_attr error_message("GemJoin/overflow"):
      # assert int128(wad) >= 0
      assert wad >= 0
    end

    let (vat) = _vat.read()
    let (ilk) = _ilk.read()
    # IVat(vat).slip(ilk, user, int256(wad))
    IVat(vat).slip(ilk, user, wad)

    with_attr error_message("GemJoin/failed-transfer"):
      let (res,) = IGem(gem).transferFrom(caller, contract_address, wad)
      assert res = 1
    end
    Join.emit(user, wad)
end

@external
func exit{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(user : felt, wad : Uint256):
    with_attr error_message("GemJoin/overflow"):
      assert_uint256_le(wad, Uint256(low=2**128-1, high=2**128-1))
    end
    let (vat) = _vat.read()
    let (ilk) = _ilk.read()
    let (gem) = _gem.read()
    # IVat(vat).slip(ilk, user, int256(wad))
    IVat(vat).slip(ilk, user, wad)

    with_attr error_message("GemJoin/failed-transfer"):
      let (res,) = IGem(gem).transfer(user, wad)
      assert res = 1
    end
    Exit.emit(user, wad)
end
