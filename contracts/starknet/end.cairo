# amarna: disable=arithmetic-sub,must-check-caller-address,must-check-overflow
# End.cairo -- Global Settlement Engine

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

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.math import assert_not_zero, assert_le_felt
from starkware.starknet.common.syscalls import (
    get_caller_address,
    get_contract_address,
    get_block_timestamp,
)
from contracts.starknet.safe_math import (
    Int256,
    add,
    _add,
    sub,
    _sub,
    mul,
    _mul,
    add_signed,
    div_rem,
)
from contracts.starknet.assertions import (
    assert_either,
    either,
    both,
    assert_both,
    not_0,
    assert_not_0,
    assert_0,
    ge,
    _ge_0,
    le,
    assert_le,
    _le_0,
    eq_0,
    check,
)
from starkware.cairo.common.uint256 import Uint256, uint256_le, uint256_neg
from contracts.starknet.wad_ray_math import (
    ray_mul,
    Ray,
    ray_mul_no_rounding,
    Wad,
    ray_to_wad_no_rounding,
)
from contracts.starknet.utils import _felt_to_uint

# interface VatLike {
#     function dai(address usr) external view returns (uint256);
#     function ilks(bytes32 ilk) external returns (
#         uint256 Art,   // [wad]
#         uint256 rate,  // [ray]
#         uint256 spot,  // [ray]
#         uint256 line,  // [rad]
#         uint256 dust   // [rad]
#     );
#     function urns(bytes32 ilk, address urn) external returns (
#         uint256 ink,   // [wad]
#         uint256 art    // [wad]
#     );
#     function debt() external returns (uint256);
#     function move(address src, address dst, uint256 rad) external;
#     function hope(address usr) external;
#     function flux(bytes32 ilk, address src, address dst, uint256 rad) external;
#     function grab(bytes32 i, address u, address v, address w, int256 dink, int256 dart) external;
#     function suck(address u, address v, uint256 rad) external;
#     function cage() external;
# }
@contract_interface
namespace VatLike:
    func dai(u : felt) -> (dai : Uint256):
    end

    func debt() -> (debt : Uint256):
    end

    func live() -> (live : felt):
    end

    func hope(usr : felt):
    end

    func frob(i : felt, u : felt, v : felt, w : felt, dink : Uint256, dart : Uint256):
    end

    func slip(ilk : felt, usr : felt, wad : Int256):
    end

    func urns(i : felt, u : felt) -> (ink : Uint256, art : Uint256):
    end

    func ilks(ilk : felt) -> (
        Art : Uint256, rate : Uint256, spot : Uint256, line : Uint256, dust : Uint256
    ):
    end

    func move(src : felt, dst : felt, rad : Uint256):
    end

    func cage():
    end

    # function grab(bytes32 i, address u, address v, address w, int256 dink, int256 dart) external;
    func grab(i : felt, u : felt, v : felt, w : felt, dink : Int256, dart : Int256):
    end

    # function flux(bytes32 ilk, address src, address dst, uint256 rad) external;
    func flux(ilk : felt, src : felt, dst : felt, rad : Uint256):
    end
end

# interface DogLike {
#     function ilks(bytes32) external returns (
#         address clip,
#         uint256 chop,
#         uint256 hole,
#         uint256 dirt
#     );
#     function cage() external;
# }

# interface PotLike {
#     function cage() external;
# }
@contract_interface
namespace PotLike:
    func cage():
    end
end

# interface VowLike {
#     function grain() external view returns (uint256);
#     function tell(uint256 value) external;
# }

# interface ClipLike {
#     function sales(uint256 id) external view returns (
#         uint256 pos,
#         uint256 tab,
#         uint256 lot,
#         address usr,
#         uint96  tic,
#         uint256 top
#     );
#     function yank(uint256 id) external;
# }

# interface PipLike {
#     function read() external view returns (bytes32);
# }

# interface SpotLike {
#     function par() external view returns (uint256);
#     function ilks(bytes32) external view returns (
#         PipLike pip,
#         uint256 mat    // [ray]
#     );
#     function cage() external;
# }
@contract_interface
namespace SpotLike:
    func cage():
    end
end

# interface CureLike {
#     function tell() external view returns (uint256);
#     function cage() external;
# }
@contract_interface
namespace CureLike:
    func cage():
    end

    func tell() -> (say : Uint256):
    end
end

# interface ClaimLike {
#     function transferFrom(address src, address dst, uint256 amount) external returns (bool);
# }
@contract_interface
namespace ClaimLike:
    func transferFrom(src : felt, dst : felt, amount : Uint256) -> (res : felt):
    end
end

# /*
#     This is the `End` and it coordinates Global Settlement. This is an
#     involved, stateful process that takes place over nine steps.

# First we freeze the system and lock the prices for each ilk.

# 1. `cage()`:
#         - freezes user entrypoints
#         - starts cooldown period
#         - stops pot drips

# 2. `cage(ilk)`:
#        - set the cage price for each `ilk`, reading off the price feed

# We must process some system state before it is possible to calculate
#     the final dai / collateral price. In particular, we need to determine

# a. `gap`, the collateral shortfall per collateral type by
#          considering under-collateralised CDPs.

# b. `debt`, the outstanding dai supply after including system
#          surplus / deficit

# We determine (a) by processing all under-collateralised CDPs with
#     `skim`:

# 3. `skim(ilk, urn)`:
#        - cancels CDP debt
#        - any excess collateral remains
#        - backing collateral taken

# 4. `free(ilk)`:
#         - remove collateral from the caller's CDP
#         - owner can call as needed

# After the processing period has elapsed, we enable calculation of
#     the final price for each collateral type.

# 5. `thaw()`:
#        - only callable after processing time period elapsed
#        - assumption that all under-collateralised CDPs are processed
#        - fixes the total outstanding supply of dai
#        - may also require extra CDP processing to cover vow surplus
#        - sends final debt amount to the DomainGuest

# 6. `flow(ilk)`:
#         - calculate the `fix`, the cash price for a given ilk
#         - adjusts the `fix` in the case of deficit / surplus

# At this point we have computed the final price for each collateral
#     type and claim token holders can now turn their claims into collateral. Each
#     unit claim token can claim a fixed basket of collateral.

# Claim token holders must first `pack` some dai into a `bag`. Once packed,
#     claims cannot be unpacked and is not transferrable. More claims can be
#     added to a bag later.

# 7. `pack(wad)`:
#         - put some claim tokens into a bag in preparation for `cash`

# Finally, collateral can be obtained with `cash`. The bigger the bag,
#     the more collateral can be released.

# 8. `cash(ilk, wad)`:
#         - exchange some dai from your bag for gems from a specific ilk
#         - the number of gems is limited by how big your bag is
# */

# contract End {
#     // --- Data ---
#     mapping (address => uint256) public wards;
@storage_var
func _wards(user : felt) -> (res : felt):
end

# VatLike   public vat;   // CDP Engine
@storage_var
func _vat() -> (res : felt):
end
# VowLike   public vow;   // Debt Engine
@storage_var
func _vow() -> (res : felt):
end
# PotLike   public pot;
@storage_var
func _pot() -> (res : felt):
end
# SpotLike  public spot;
@storage_var
func _spot() -> (res : felt):
end
# CureLike  public cure;
@storage_var
func _cure() -> (res : felt):
end
# ClaimLike public claim;
@storage_var
func _claim() -> (res : felt):
end

# uint256  public live;  // Active Flag
@storage_var
func _live() -> (live : felt):
end
# uint256  public when;  // Time of cage                   [unix epoch time]
@storage_var
func _when() -> (when : felt):
end
# uint256  public wait;  // Processing Cooldown Length             [seconds]
@storage_var
func _wait() -> (wait : felt):
end
# uint256  public debt;  // Total outstanding dai following processing [rad]
@storage_var
func _debt() -> (debt : Uint256):
end

# mapping (bytes32 => uint256) public tag;  // Cage price              [ray]
@storage_var
func _tag(ilk : felt) -> (price : Uint256):
end
# mapping (bytes32 => uint256) public gap;  // Collateral shortfall    [wad]
@storage_var
func _gap(ilk : felt) -> (gap : Uint256):
end
# mapping (bytes32 => uint256) public Art;  // Total debt per ilk      [wad]
@storage_var
func _Art(ilk : felt) -> (Art : Uint256):
end
# mapping (bytes32 => uint256) public fix;  // Final cash price        [ray]
@storage_var
func _fix(ilk : felt) -> (fix : Uint256):
end

# mapping (address => uint256)                      public bag;  //    [wad]
@storage_var
func _bag(address : felt) -> (bag : Uint256):
end
# mapping (bytes32 => mapping (address => uint256)) public out;  //    [wad]
@storage_var
func _out(ilk : felt, address : felt) -> (out : Uint256):
end

# // --- Events ---
#     event Rely(address indexed usr);
#     event Deny(address indexed usr);
@event
func Rely(user : felt):
end

@event
func Deny(user : felt):
end
# event File(bytes32 indexed what, uint256 data);
#     event File(bytes32 indexed what, address data);
#     event Cage();
@event
func Cage():
end
# event Cage(bytes32 indexed ilk);
#     event Skim(bytes32 indexed ilk, address indexed urn, uint256 wad, uint256 art);
@event
func Skim(ilk : felt, urn : felt, wad : Uint256, art : Uint256):
end
# event Free(bytes32 indexed ilk, address indexed usr, uint256 ink);
@event
func Free(ilk : felt, usr : felt, ink : Uint256):
end
# event Thaw();
@event
func Thaw():
end
# event Flow(bytes32 indexed ilk);
@event
func Flow(ilk : felt):
end
# event Pack(address indexed usr, uint256 wad);
@event
func Pack(usr : felt, wad : Uint256):
end
# event Cash(bytes32 indexed ilk, address indexed usr, uint256 wad);
@event
func Cash(ilk : felt, usr : felt, wad : Uint256):
end

# modifier auth {
#         require(wards[msg.sender] == 1, "End/not-authorized");
#         _;
#     }
func auth{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}():
    let (caller) = get_caller_address()
    let (ward) = _wards.read(caller)
    with_attr error_message("End/not-authorized"):
        assert ward = 1
    end
    return ()
end

# // --- Init ---
#     constructor() {
#         wards[msg.sender] = 1;
#         emit Rely(msg.sender);

# live = 1;
#     }
@constructor
func constructor{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(ward : felt):
    # wards[msg.sender] = 1;
    _wards.write(ward, 1)

    # live = 1;
    _live.write(1)

    # emit Rely(msg.sender);
    Rely.emit(ward)

    return ()
end

func require_live{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}():
    # require(live == 1, "End/not-live");
    with_attr error_message("End/not-live"):
        let (live) = _live.read()
        assert live = 1
    end

    return ()
end

@view
func wards{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(user : felt) -> (
    res : felt
):
    let (res) = _wards.read(user)
    return (res)
end

# // --- Math ---
#     uint256 constant WAD = 10 ** 18;
#     uint256 constant RAY = 10 ** 27;
#     function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
#         return x <= y ? x : y;
#     }
func _min{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    x : Uint256, y : Uint256
) -> (z : Uint256):
    let (x_le : felt) = uint256_le(x, y)
    if x_le == 1:
        return (z=x)
    else:
        return (z=y)
    end
end
# function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
#         z = x * y / RAY;
#     }
#     function wdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
#         z = x * WAD / y;
#     }

# // --- Administration ---
#     function rely(address usr) external auth {
#         wards[usr] = 1;
#         emit Rely(usr);
#     }
@external
func rely{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(user : felt):
    auth()

    # require(live == 1, "End/not-live");
    require_live()

    # wards[usr] = 1;
    _wards.write(user, 1)

    # emit Rely(user);
    Rely.emit(user)

    return ()
end

# function deny(address usr) external auth {
#         wards[usr] = 0;
#         emit Deny(usr);
#     }
@external
func deny{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(user : felt):
    auth()

    # require(live == 1, "End/not-live");
    # TODO: consider: https://github.com/makerdao/xdomain-dss/issues/4
    require_live()

    # wards[usr] = 0;
    _wards.write(user, 0)

    # emit Deny(usr);
    Deny.emit(user)

    return ()
end

# function file(bytes32 what, address data) external auth {
#         require(live == 1, "End/not-live");
#         if (what == "vat")  vat = VatLike(data);
#         else if (what == "vow")   vow = VowLike(data);
#         else if (what == "pot")   pot = PotLike(data);
#         else if (what == "spot") spot = SpotLike(data);
#         else if (what == "cure") cure = CureLike(data);
#         else if (what == "claim") claim = ClaimLike(data);
#         else revert("End/file-unrecognized-param");
#         emit File(what, data);
#     }
#     function file(bytes32 what, uint256 data) external auth {
#         require(live == 1, "End/not-live");
#         if (what == "wait") wait = data;
#         else revert("End/file-unrecognized-param");
#         emit File(what, data);
#     }

# // --- Settlement ---
#     function cage() external auth {
#         require(live == 1, "End/not-live");
#         live = 0;
#         when = block.timestamp;
#         vat.cage();
#         spot.cage();
#         pot.cage();
#         cure.cage();
#         emit Cage();
#     }
@external
func cage{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}():
    auth()
    require_live()

    # live = 0;
    _live.write(0)

    let (timestamp) = get_block_timestamp()
    _when.write(timestamp)

    let (vat) = _vat.read()
    let (spot) = _spot.read()
    let (pot) = _pot.read()
    let (cure) = _cure.read()

    VatLike.cage(vat)
    SpotLike.cage(spot)
    PotLike.cage(pot)
    CureLike.cage(cure)

    # emit Cage();
    Cage.emit()

    return ()
end

# function cage(bytes32 ilk) external {
#         require(live == 0, "End/still-live");
#         require(tag[ilk] == 0, "End/tag-ilk-already-defined");
#         (Art[ilk],,,,) = vat.ilks(ilk);
#         (PipLike pip,) = spot.ilks(ilk);
#         // par is a ray, pip returns a wad
#         tag[ilk] = wdiv(spot.par(), uint256(pip.read()));
#         emit Cage(ilk);
#     }

# function skim(bytes32 ilk, address urn) external {
@external
func skim{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(ilk : felt, urn : felt):
    alloc_locals
    # require(tag[ilk] != 0, "End/tag-ilk-not-defined");
    let (tag) = _tag.read(ilk)
    with_attr error_message("End/tag-ilk-not-defined"):
        assert_not_0(tag)
    end
    # (, uint256 rate,,,) = vat.ilks(ilk);
    let (vat) = _vat.read()
    let (_, rate : Uint256, _, _, _) = VatLike.ilks(vat, ilk)
    # (uint256 ink, uint256 art) = vat.urns(ilk, urn);
    let (ink : Uint256, art : Uint256) = VatLike.urns(vat, ilk, urn)

    # uint256 owe = rmul(rmul(art, rate), tag[ilk]);
    local art_ : Ray = Ray(art)
    local rate_ : Ray = Ray(art)
    let (mul : Ray) = ray_mul_no_rounding(art_, rate_)
    local tag_ : Ray = Ray(tag)
    let (owe) = ray_mul_no_rounding(mul, tag_)
    # uint256 wad = min(ink, owe);
    let (wad) = _min(ink, owe.ray)
    # gap[ilk] = gap[ilk] + (owe - wad);
    let (gap) = _gap.read(ilk)
    let (sub_) = sub(owe.ray, wad)
    let (new_gap) = add(gap, sub_)
    _gap.write(ilk, new_gap)

    # require(wad <= 2**255 && art <= 2**255, "End/overflow");
    with_attr error_message("End/overflow"):
        let (max) = _felt_to_uint(2 ** 255)
        let (wad_overflow) = le(wad, max)
        let (art_overflow) = le(art, max)
        assert_both(wad_overflow, art_overflow)
    end

    let (vow) = _vow.read()
    let (self) = get_contract_address()
    let (minus_wad) = uint256_neg(wad)
    let (minus_art) = uint256_neg(art)
    # vat.grab(ilk, urn, address(this), address(vow), -int256(wad), -int256(art));
    VatLike.grab(vat, ilk, urn, self, vow, minus_wad, minus_art)
    # emit Skim(ilk, urn, wad, art);
    Skim.emit(ilk, urn, wad, art)
    return ()
end

# function free(bytes32 ilk) external {
@external
func free{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(ilk : felt):
    alloc_locals
    # require(live == 0, "End/still-live");
    require_live()
    # (uint256 ink, uint256 art) = vat.urns(ilk, msg.sender);
    let (vat) = _vat.read()
    let (sender) = get_caller_address()
    let (ink : Uint256, art : Uint256) = VatLike.urns(vat, ilk, sender)

    # require(art == 0, "End/art-not-zero");
    with_attr error_message("End/art-not-zero"):
        assert_0(art)
    end
    # require(ink <= 2**255, "End/overflow");
    with_attr error_message("End/overflow"):
        let (max) = _felt_to_uint(2 ** 255)
        assert_le(ink, max)
    end
    let (vow) = _vow.read()
    let (minus_ink) = uint256_neg(ink)
    # vat.grab(ilk, msg.sender, msg.sender, address(vow), -int256(ink), 0);
    VatLike.grab(vat, ilk, sender, sender, vow, minus_ink, Uint256(0, 0))
    # emit Free(ilk, msg.sender, ink);
    Free.emit(ilk, sender, ink)
    return ()
end
# }

# function thaw() external {
@external
func thaw{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}():
    alloc_locals
    # require(live == 0, "End/still-live");
    require_live()
    # require(debt == 0, "End/debt-not-zero");
    let (debt) = _debt.read()
    with_attr error_message("End/debt-not-zero"):
        assert_0(debt)
    end
    # require(vat.dai(address(vow)) == 0, "End/surplus-not-zero");
    let (vat) = _vat.read()
    with_attr error_message("End/surplus-not-zero"):
        let (vow) = _vow.read()
        let (surplus) = VatLike.dai(vat, vow)
        assert_0(surplus)
    end
    # require(block.timestamp >= when + wait, "End/wait-not-finished");
    with_attr error_message("End/wait-not-finished"):
        let (when) = _when.read()
        let (wait) = _wait.read()
        let (timestamp) = get_block_timestamp()
        assert_le_felt(when + wait, timestamp)
    end

    # debt = vat.debt() - cure.tell();
    let (cure) = _cure.read()
    let (vat_debt) = VatLike.debt(vat)
    let (cure_debt) = CureLike.tell(cure)
    let (new_debt) = sub(vat_debt, cure_debt)
    _debt.write(new_debt)
    # emit Thaw();
    Thaw.emit()
    return ()
end

# function flow(bytes32 ilk) external {
@external
func flow{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(ilk : felt):
    alloc_locals
    # require(debt != 0, "End/debt-zero");
    let (debt) = _debt.read()
    with_attr error_message("End/debt-zero"):
        assert_not_0(debt)
    end
    # require(fix[ilk] == 0, "End/fix-ilk-already-defined");
    with_attr error_message("End/fix-ilk-already-defined"):
        let (fix) = _fix.read(ilk)
        assert_0(fix)
    end

    # (, uint256 rate,,,) = vat.ilks(ilk);
    let (vat) = _vat.read()
    let (_, rate : Uint256, _, _, _) = VatLike.ilks(vat, ilk)

    local rate_ : Ray = Ray(rate)
    let (tag) = _tag.read(ilk)
    let (Art) = _Art.read(ilk)
    local Art_ : Ray = Ray(Art)
    local tag_ : Ray = Ray(tag)

    # uint256 wad = rmul(rmul(Art[ilk], rate), tag[ilk]);
    let (mul_ : Ray) = ray_mul_no_rounding(Art_, rate_)
    let (ray : Ray) = ray_mul_no_rounding(mul_, tag_)
    let (wad : Wad) = ray_to_wad_no_rounding(ray)
    # fix[ilk] = (wad - gap[ilk]) * RAY / (debt / RAY);
    let (gap) = _gap.read(ilk)
    let (res) = sub(wad.wad, gap)
    let (ray_sub) = mul(res, Uint256(10 ** 27, 0))
    let (ray_debt, _) = div_rem(debt, Uint256(10 ** 27, 0))
    let (new_fix, _) = div_rem(ray_sub, ray_debt)
    # emit Flow(ilk);
    Flow.emit(ilk)
    return ()
end

# function pack(uint256 wad) external {
#         require(debt != 0, "End/debt-zero");
#         require(claim.transferFrom(msg.sender, address(vow), wad), "End/transfer-failed");
#         bag[msg.sender] = bag[msg.sender] + wad;
#         emit Pack(msg.sender, wad);
#     }
@external
func pack{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(wad : Uint256):
    let (debt) = _debt.read()
    with_attr error_message("End/debt-zero"):
        assert_not_0(debt)
    end

    let (sender) = get_caller_address()
    with_attr error_message("End/transfer-failed"):
        let (claim) = _claim.read()
        let (vow) = _vow.read()
        let (success) = ClaimLike.transferFrom(claim, sender, vow, wad)
        assert_not_zero(success)
    end

    let (bag) = _bag.read(sender)
    let (new_bag) = add(bag, wad)
    _bag.write(sender, new_bag)

    Pack.emit(sender, wad)

    return ()
end
# function cash(bytes32 ilk, uint256 wad) external {
@external
func cash{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(ilk : felt, wad : Uint256):
    alloc_locals
    # require(fix[ilk] != 0, "End/fix-ilk-not-defined");
    let (fix) = _fix.read(ilk)
    with_attr error_message("End/fix-ilk-already-defined"):
        assert_not_0(fix)
    end
    let (vat) = _vat.read()
    let (self) = get_contract_address()
    let (sender) = get_caller_address()
    local wad_ : Ray = Ray(wad)
    local fix_ : Ray = Ray(fix)
    let (new_fix) = ray_mul_no_rounding(wad_, fix_)
    # vat.flux(ilk, address(this), msg.sender, rmul(wad, fix[ilk]));
    VatLike.flux(vat, ilk, self, sender, new_fix.ray)
    # out[ilk][msg.sender] = out[ilk][msg.sender] + wad;
    let (out) = _out.read(ilk, sender)
    let (new_out) = add(out, wad)
    _out.write(ilk, sender, new_out)
    # require(out[ilk][msg.sender] <= bag[msg.sender], "End/insufficient-bag-balance");
    with_attr error_message("End/insufficient-bag-balance"):
        let (bag) = _bag.read(sender)
        assert_le(new_out, bag)
    end
    # emit Cash(ilk, msg.sender, wad);
    Cash.emit(ilk, sender, wad)
    return ()
end
# }
