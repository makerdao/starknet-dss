// amarna: disable=arithmetic-sub,must-check-caller-address,must-check-overflow
// End.cairo -- Global Settlement Engine

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

// https://github.com/makerdao/xdomain-dss/blob/add-end/src/End.sol
// #commit#f539db019725075fcf493eb0b0cc02c8b83f8010

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.math import assert_not_zero, assert_le_felt
from starkware.starknet.common.syscalls import (
    get_caller_address,
    get_contract_address,
    get_block_timestamp,
)
from safe_math import (
    Int256,
    add,
    _add,
    sub,
    _sub,
    mul,
    _mul,
    add_signed,
    div,
    div_rem,
    _felt_to_uint,
)
from assertions import (
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

// interface VatLike {
//     function dai(address usr) external view returns (uint256);
//     function ilks(bytes32 ilk) external returns (
//         uint256 Art,   // [wad]
//         uint256 rate,  // [ray]
//         uint256 spot,  // [ray]
//         uint256 line,  // [rad]
//         uint256 dust   // [rad]
//     );
//     function urns(bytes32 ilk, address urn) external returns (
//         uint256 ink,   // [wad]
//         uint256 art    // [wad]
//     );
//     function debt() external returns (uint256);
//     function move(address src, address dst, uint256 rad) external;
//     function hope(address usr) external;
//     function flux(bytes32 ilk, address src, address dst, uint256 rad) external;
//     function grab(bytes32 i, address u, address v, address w, int256 dink, int256 dart) external;
//     function cage() external;
// }
@contract_interface
namespace VatLike {
    func dai(u: felt) -> (dai: Uint256) {
    }

    func ilks(ilk: felt) -> (
        Art: Uint256, rate: Uint256, spot: Uint256, line: Uint256, dust: Uint256
    ) {
    }

    func urns(i: felt, u: felt) -> (ink: Uint256, art: Uint256) {
    }

    func debt() -> (debt: Uint256) {
    }

    func hope(usr: felt) {
    }

    func flux(ilk: felt, src: felt, dst: felt, rad: Uint256) {
    }

    func grab(i: felt, u: felt, v: felt, w: felt, dink: Int256, dart: Int256) {
    }

    func cage() {
    }
}

// interface DogLike {
//     function ilks(bytes32) external returns (
//         address clip,
//         uint256 chop,
//         uint256 hole,
//         uint256 dirt
//     );
//     function cage() external;
// }
@contract_interface
namespace DogLike {
    func ilks(ilk: felt) -> (clip: felt, chop: Uint256, hole: Uint256, dirt: Uint256) {
    }

    func cage() {
    }
}

// interface PotLike {
//     function cage() external;
// }
@contract_interface
namespace PotLike {
    func cage() {
    }
}

// interface VowLike {
//     function grain() external view returns (uint256);
//     function tell(uint256 value) external;
// }
@contract_interface
namespace VowLike {
    func grain() -> (Line: Uint256) {
    }

    func tell(value: Uint256) {
    }
}

// interface ClipLike {
//     function sales(uint256 id) external view returns (
//         uint256 pos,
//         uint256 tab,
//         uint256 lot,
//         address usr,
//         uint96  tic,
//         uint256 top
//     );
//     function yank(uint256 id) external;
// }
@contract_interface
namespace ClipLike {
    func sales(id: Uint256) -> (
        pos: Uint256, tab: Uint256, lot: Uint256, usr: felt, tic: felt, top: Uint256
    ) {
    }

    func yank(id: Uint256) {
    }
}

// interface PipLike {
//     function read() external view returns (bytes32);
// }
@contract_interface
namespace PipLike {
    func read() -> (pip: Uint256) {
    }
}

// interface SpotLike {
//     function par() external view returns (uint256);
//     function ilks(bytes32) external view returns (
//         PipLike pip,
//         uint256 mat    // [ray]
//     );
//     function cage() external;
// }
@contract_interface
namespace SpotLike {
    func par() -> (par: Uint256) {
    }

    func ilks(ilk: felt) -> (pip: felt, mat: Uint256) {
    }

    func cage() {
    }
}

// interface CureLike {
//     function tell() external view returns (uint256);
//     function cage() external;
// }
@contract_interface
namespace CureLike {
    func cage() {
    }

    func tell() -> (say: Uint256) {
    }
}

// interface ClaimLike {
//     function transferFrom(address src, address dst, uint256 amount) external returns (bool);
// }
@contract_interface
namespace ClaimLike {
    func mint(to: felt, value: Uint256) {
    }
    func burn(account: felt, value: Uint256) {
    }
    func approve(spender: felt, value: Uint256) {
    }
}

// /*
//     This is the `End` and it coordinates Global Settlement. This is an
//     involved, stateful process that takes place over nine steps.

// First we freeze the system and lock the prices for each ilk.

// 1. `cage()`:
//         - freezes user entrypoints
//         - starts cooldown period
//         - stops pot drips

// 2. `cage(ilk)`:
//        - set the cage price for each `ilk`, reading off the price feed

// We must process some system state before it is possible to calculate
//     the final dai / collateral price. In particular, we need to determine

// a. `gap`, the collateral shortfall per collateral type by
//          considering under-collateralised CDPs.

// b. `debt`, the outstanding dai supply after including system
//          surplus / deficit

// We determine (a) by processing all under-collateralised CDPs with
//     `skim`:

// 3. `skim(ilk, urn)`:
//        - cancels CDP debt
//        - any excess collateral remains
//        - backing collateral taken

// 4. `free(ilk)`:
//         - remove collateral from the caller's CDP
//         - owner can call as needed

// After the processing period has elapsed, we enable calculation of
//     the final price for each collateral type.

// 5. `thaw()`:
//        - only callable after processing time period elapsed
//        - assumption that all under-collateralised CDPs are processed
//        - fixes the total outstanding supply of dai
//        - may also require extra CDP processing to cover vow surplus
//        - sends final debt amount to the DomainGuest

// 6. `flow(ilk)`:
//         - calculate the `fix`, the cash price for a given ilk
//         - adjusts the `fix` in the case of deficit / surplus

// At this point we have computed the final price for each collateral
//     type and claim token holders can now turn their claims into collateral. Each
//     unit claim token can claim a fixed basket of collateral.

// Claim token holders must first `pack` some dai into a `bag`. Once packed,
//     claims cannot be unpacked and is not transferrable. More claims can be
//     added to a bag later.

// 7. `pack(wad)`:
//         - put some claim tokens into a bag in preparation for `cash`

// Finally, collateral can be obtained with `cash`. The bigger the bag,
//     the more collateral can be released.

// 8. `cash(ilk, wad)`:
//         - exchange some dai from your bag for gems from a specific ilk
//         - the number of gems is limited by how big your bag is
// */

// contract End {
//     // --- Data ---
//     mapping (address => uint256) public wards;
@storage_var
func _wards(user: felt) -> (res: felt) {
}

// VatLike   public vat;   // CDP Engine
@storage_var
func _vat() -> (res: felt) {
}
// VowLike   public vow;   // Debt Engine
@storage_var
func _vow() -> (res: felt) {
}
// PotLike   public pot;
@storage_var
func _pot() -> (res: felt) {
}
// SpotLike  public spot;
@storage_var
func _spot() -> (res: felt) {
}
// CureLike  public cure;
@storage_var
func _cure() -> (res: felt) {
}
// ClaimLike public claim;
@storage_var
func _claim() -> (res: felt) {
}

// uint256  public live;  // Active Flag
@storage_var
func _live() -> (live: felt) {
}
// uint256  public when;  // Time of cage                   [unix epoch time]
@storage_var
func _when() -> (when: felt) {
}
// uint256  public wait;  // Processing Cooldown Length             [seconds]
@storage_var
func _wait() -> (wait: felt) {
}
// uint256  public debt;  // Total outstanding dai following processing [rad]
@storage_var
func _debt() -> (debt: Uint256) {
}

// mapping (bytes32 => uint256) public tag;  // Cage price              [ray]
@storage_var
func _tag(ilk: felt) -> (price: Uint256) {
}
// mapping (bytes32 => uint256) public gap;  // Collateral shortfall    [wad]
@storage_var
func _gap(ilk: felt) -> (gap: Uint256) {
}
// mapping (bytes32 => uint256) public Art;  // Total debt per ilk      [wad]
@storage_var
func _Art(ilk: felt) -> (Art: Uint256) {
}
// mapping (bytes32 => uint256) public fix;  // Final cash price        [ray]
@storage_var
func _fix(ilk: felt) -> (fix: Uint256) {
}

// mapping (address => uint256)                      public bag;  //    [wad]
@storage_var
func _bag(address: felt) -> (bag: Uint256) {
}
// mapping (bytes32 => mapping (address => uint256)) public out;  //    [wad]
@storage_var
func _out(ilk: felt, address: felt) -> (out: Uint256) {
}

// // --- Events ---
//     event Rely(address indexed usr);
//     event Deny(address indexed usr);
@event
func Rely(usr: felt) {
}

@event
func Deny(usr: felt) {
}

// event File(bytes32 indexed what, address data);
@event
func File(what: felt, data: felt) {
}
// event Cage();
@event
func Cage() {
}
// event Cage(bytes32 indexed ilk);
@event
func Cage_ilk(ilk: felt) {
}
// event Skim(bytes32 indexed ilk, address indexed urn, uint256 wad, uint256 art);
@event
func Skim(ilk: felt, urn: felt, wad: Uint256, art: Uint256) {
}
// event Free(bytes32 indexed ilk, address indexed usr, uint256 ink);
@event
func Free(ilk: felt, usr: felt, ink: Uint256) {
}
// event Thaw();
@event
func Thaw() {
}
// event Flow(bytes32 indexed ilk);
@event
func Flow(ilk: felt) {
}
// event Pack(address indexed usr, uint256 wad);
@event
func Pack(usr: felt, wad: Uint256) {
}
// event Cash(bytes32 indexed ilk, address indexed usr, uint256 wad);
@event
func Cash(ilk: felt, usr: felt, wad: Uint256) {
}

// modifier auth {
//         require(wards[msg.sender] == 1, "End/not-authorized");
//         _;
//     }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (ward) = _wards.read(caller);
    with_attr error_message("End/not-authorized") {
        assert ward = 1;
    }
    return ();
}

// // --- Init ---
//     constructor() {
//         wards[msg.sender] = 1;
//         emit Rely(msg.sender);

// live = 1;
//     }
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    ward: felt, vat: felt
) {
    // wards[msg.sender] = 1;
    _wards.write(ward, 1);

    // live = 1;
    _live.write(1);

    _vat.write(vat);

    // emit Rely(msg.sender);
    Rely.emit(ward);

    return ();
}

func require_live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    // require(live == 1, "End/not-live");
    with_attr error_message("End/not-live") {
        let (live) = _live.read();
        assert live = 1;
    }

    return ();
}

func require_not_live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    // require(live == 1, "End/not-live");
    with_attr error_message("End/still-live") {
        let (live) = _live.read();
        assert live = 0;
    }

    return ();
}

@view
func wards{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(user: felt) -> (
    res: felt
) {
    let (res) = _wards.read(user);
    return (res,);
}

@view
func live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _live.read();
    return (res,);
}

@view
func fix{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ilk: felt) -> (
    res: Uint256
) {
    let (res) = _fix.read(ilk);
    return (res,);
}

@view
func out{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    ilk: felt, user: felt
) -> (res: Uint256) {
    let (res) = _out.read(ilk, user);
    return (res,);
}

@view
func gap{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ilk: felt) -> (
    res: Uint256
) {
    let (res) = _gap.read(ilk);
    return (res,);
}

@view
func Art{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ilk: felt) -> (
    res: Uint256
) {
    let (res) = _Art.read(ilk);
    return (res,);
}

@view
func vat{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _vat.read();
    return (res,);
}

@view
func debt{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: Uint256) {
    let (res) = _debt.read();
    return (res,);
}

// --- Math ---

// uint256 constant WAD = 10 ** 18;
const WAD = 10 ** 18;
// uint256 constant RAY = 10 ** 27;
const RAY = 10 ** 27;

// function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
//         return x <= y ? x : y;
//     }
func min{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    x: Uint256, y: Uint256
) -> (z: Uint256) {
    let (x_le: felt) = uint256_le(x, y);
    if (x_le == 1) {
        return (z=x);
    } else {
        return (z=y);
    }
}
// function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
//         z = x * y / RAY;
//     }
func rmul{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    x: Uint256, y: Uint256
) -> (z: Uint256) {
    let (mul_) = mul(x, y);
    let (z) = div(mul_, Uint256(RAY, 0));
    return (z,);
}

// function wdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
//         z = x * WAD / y;
//     }
func wdiv{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    x: Uint256, y: Uint256
) -> (z: Uint256) {
    let (mul_) = mul(x, Uint256(WAD, 0));
    let (z) = div(mul_, y);
    return (z,);
}

// --- Administration ---

// function rely(address usr) external auth {
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // require(live == 1, "End/not-live");
    require_live();

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

    // require(live == 1, "End/not-live");
    require_live();

    // wards[usr] = 0;
    _wards.write(usr, 0);

    // emit Deny(usr);
    Deny.emit(usr);

    return ();
}

// function file(bytes32 what, address data) external auth {
//         require(live == 1, "End/not-live");
//         if (what == "vat")  vat = VatLike(data);
//         else if (what == "vow")   vow = VowLike(data);
//         else if (what == "pot")   pot = PotLike(data);
//         else if (what == "spot") spot = SpotLike(data);
//         else if (what == "cure") cure = CureLike(data);
//         else if (what == "claim") claim = ClaimLike(data);
//         else revert("End/file-unrecognized-param");
//         emit File(what, data);
//     }
@external
func file{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(what: felt, data: felt) {
    alloc_locals;
    auth();
    require_live();

    if (what == 'vow') {
        _vow.write(data);
        File.emit(what, data);
        return ();
    }
    if (what == 'pot') {
        _pot.write(data);
        File.emit(what, data);
        return ();
    }
    if (what == 'spot') {
        _spot.write(data);
        File.emit(what, data);
        return ();
    }
    if (what == 'cure') {
        _cure.write(data);
        File.emit(what, data);
        return ();
    }
    if (what == 'claim') {
        _claim.write(data);
        File.emit(what, data);
        return ();
    }
    if (what == 'wait') {
        _wait.write(data);
        File.emit(what, data);
        return ();
    }

    with_attr error_message("End/file-unrecognized-param") {
        assert 0 = 1;
    }

    return ();
}

// // --- Settlement ---
//     function cage() external auth {
//         require(live == 1, "End/not-live");
//         live = 0;
//         when = block.timestamp;
//         vat.cage();
//         spot.cage();
//         pot.cage();
//         cure.cage();
//         emit Cage();
//     }
@external
func cage{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    auth();
    require_live();

    // live = 0;
    _live.write(0);

    let (timestamp) = get_block_timestamp();
    _when.write(timestamp);

    let (vat) = _vat.read();
    let (spot) = _spot.read();
    let (pot) = _pot.read();
    let (cure) = _cure.read();

    VatLike.cage(vat);
    SpotLike.cage(spot);
    PotLike.cage(pot);
    CureLike.cage(cure);

    // emit Cage();
    Cage.emit();

    return ();
}

// function cage(bytes32 ilk) external {
@external
func cage_ilk{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ilk: felt) {
    alloc_locals;
    // require(live == 0, "End/still-live");
    require_not_live();
    // require(tag[ilk] == 0, "End/tag-ilk-already-defined");
    let (tag) = _tag.read(ilk);
    with_attr error_message("End/tag-ilk-already-defined") {
        assert_0(tag);
    }
    // (Art[ilk],,,,) = vat.ilks(ilk);
    let (vat) = _vat.read();
    let (Art: Uint256, _, _, _, _) = VatLike.ilks(vat, ilk);
    _Art.write(ilk, Art);
    // (PipLike pip,) = spot.ilks(ilk);
    let (spot) = _spot.read();
    let (pip: felt, _) = SpotLike.ilks(spot, ilk);
    // par is a ray, pip returns a wad
    let (par) = SpotLike.par(spot);
    let (pip_val) = PipLike.read(pip);
    // tag[ilk] = wdiv(spot.par(), uint256(pip.read()));
    let (new_tag) = wdiv(par, pip_val);
    _tag.write(ilk, new_tag);
    // emit Cage(ilk);
    Cage_ilk.emit(ilk);
    // }

    return ();
}

// function skim(bytes32 ilk, address urn) external {
@external
func skim{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(ilk: felt, urn: felt) {
    alloc_locals;
    // require(tag[ilk] != 0, "End/tag-ilk-not-defined");
    let (tag) = _tag.read(ilk);
    with_attr error_message("End/tag-ilk-not-defined") {
        assert_not_0(tag);
    }
    // (, uint256 rate,,,) = vat.ilks(ilk);
    let (vat) = _vat.read();
    let (_, rate: Uint256, _, _, _) = VatLike.ilks(vat, ilk);
    // (uint256 ink, uint256 art) = vat.urns(ilk, urn);
    let (ink: Uint256, art: Uint256) = VatLike.urns(vat, ilk, urn);

    // uint256 owe = rmul(rmul(art, rate), tag[ilk]);
    let (mul_) = rmul(art, rate);
    let (owe) = rmul(mul_, tag);
    // uint256 wad = min(ink, owe);
    let (wad) = min(ink, owe);
    // gap[ilk] = gap[ilk] + (owe - wad);
    let (gap) = _gap.read(ilk);
    let (sub_) = sub(owe, wad);
    let (new_gap) = add(gap, sub_);
    _gap.write(ilk, new_gap);

    // require(wad <= 2**255 && art <= 2**255, "End/overflow");
    with_attr error_message("End/overflow") {
        let max = Uint256(2 ** 128 - 1, 2 ** 128 - 1);
        let (wad_overflow) = le(wad, max);
        let (art_overflow) = le(art, max);
        assert_both(wad_overflow, art_overflow);
    }

    let (vow) = _vow.read();
    let (self) = get_contract_address();
    let (minus_wad) = uint256_neg(wad);
    let (minus_art) = uint256_neg(art);
    // vat.grab(ilk, urn, address(this), address(vow), -int256(wad), -int256(art));
    VatLike.grab(vat, ilk, urn, self, vow, minus_wad, minus_art);
    // emit Skim(ilk, urn, wad, art);
    Skim.emit(ilk, urn, wad, art);
    return ();
}

// function free(bytes32 ilk) external {
@external
func free{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ilk: felt) {
    alloc_locals;
    // require(live == 0, "End/still-live");
    require_not_live();
    // (uint256 ink, uint256 art) = vat.urns(ilk, msg.sender);
    let (vat) = _vat.read();
    let (sender) = get_caller_address();
    let (ink: Uint256, art: Uint256) = VatLike.urns(vat, ilk, sender);

    // require(art == 0, "End/art-not-zero");
    with_attr error_message("End/art-not-zero") {
        assert_0(art);
    }
    // require(ink <= 2**255, "End/overflow");
    with_attr error_message("End/overflow") {
        let max = Uint256(2 ** 128 - 1, 2 ** 128 - 1);
        assert_le(ink, max);
    }
    let (vow) = _vow.read();
    let (minus_ink) = uint256_neg(ink);
    // vat.grab(ilk, msg.sender, msg.sender, address(vow), -int256(ink), 0);
    VatLike.grab(vat, ilk, sender, sender, vow, minus_ink, Uint256(0, 0));
    // emit Free(ilk, msg.sender, ink);
    Free.emit(ilk, sender, ink);
    return ();
}

// function thaw() external {
@external
func thaw{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}() {
    alloc_locals;
    // require(live == 0, "End/still-live");
    require_not_live();
    // require(debt == 0, "End/debt-not-zero");
    let (debt) = _debt.read();
    with_attr error_message("End/debt-not-zero") {
        assert_0(debt);
    }
    // require(vat.dai(address(vow)) == 0, "End/surplus-not-zero");
    let (vat) = _vat.read();
    let (vow) = _vow.read();
    with_attr error_message("End/surplus-not-zero") {
        let (surplus) = VatLike.dai(vat, vow);
        assert_0(surplus);
    }
    // require(block.timestamp >= when + wait, "End/wait-not-finished");
    with_attr error_message("End/wait-not-finished") {
        let (when) = _when.read();
        let (wait) = _wait.read();
        let (timestamp) = get_block_timestamp();
        assert_le_felt(when + wait, timestamp);
    }

    // debt = vat.debt() - cure.tell();
    let (cure) = _cure.read();
    let (vat_debt) = VatLike.debt(vat);
    let (cure_debt) = CureLike.tell(cure);
    let (new_debt) = sub(vat_debt, cure_debt);
    _debt.write(new_debt);

    let (self) = get_contract_address();
    let (claim) = _claim.read();

    // claim.mint(address(this), debt);
    ClaimLike.mint(claim, self, new_debt);

    // claim.approve(vow, type(uint256).max);
    let max = Uint256(2 ** 128 - 1, 2 ** 128 - 1);
    ClaimLike.approve(claim, vow, max);

    // emit Thaw();
    Thaw.emit();

    return ();
}

// function flow(bytes32 ilk) external {
@external
func flow{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(ilk: felt) {
    alloc_locals;
    // require(debt != 0, "End/debt-zero");
    let (debt) = _debt.read();
    with_attr error_message("End/debt-zero") {
        assert_not_0(debt);
    }
    // require(fix[ilk] == 0, "End/fix-ilk-already-defined");
    with_attr error_message("End/fix-ilk-already-defined") {
        let (fix) = _fix.read(ilk);
        assert_0(fix);
    }

    // (, uint256 rate,,,) = vat.ilks(ilk);
    let (vat) = _vat.read();
    let (_, rate: Uint256, _, _, _) = VatLike.ilks(vat, ilk);

    let (tag) = _tag.read(ilk);
    let (Art) = _Art.read(ilk);

    // uint256 wad = rmul(rmul(Art[ilk], rate), tag[ilk]);
    let (mul_) = rmul(Art, rate);
    let (wad) = rmul(mul_, tag);
    // fix[ilk] = (wad - gap[ilk]) * RAY / (debt / RAY);
    let (gap) = _gap.read(ilk);
    let (res) = sub(wad, gap);
    let (ray_sub) = mul(res, Uint256(RAY, 0));
    let (ray_debt) = div(debt, Uint256(RAY, 0));

    let (new_fix) = div(ray_sub, ray_debt);
    _fix.write(ilk, new_fix);

    // emit Flow(ilk);
    Flow.emit(ilk);
    return ();
}

// function pack(uint256 wad) external {
//         require(debt != 0, "End/debt-zero");
//         require(claim.transferFrom(msg.sender, address(vow), wad), "End/transfer-failed");
//         bag[msg.sender] = bag[msg.sender] + wad;
//         emit Pack(msg.sender, wad);
//     }
@external
func pack{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(wad: Uint256) {
    let (debt) = _debt.read();
    with_attr error_message("End/debt-zero") {
        assert_not_0(debt);
    }

    let (sender) = get_caller_address();
    // claim.burn(msg.sender, wad * RAY);
    let (value) = mul(wad, Uint256(RAY, 0));
    let (claim) = _claim.read();
    ClaimLike.burn(claim, sender, value);

    let (bag) = _bag.read(sender);
    let (new_bag) = add(bag, wad);
    _bag.write(sender, new_bag);

    Pack.emit(sender, wad);

    return ();
}
// function cash(bytes32 ilk, uint256 wad) external {
@external
func cash{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(ilk: felt, wad: Uint256) {
    alloc_locals;
    // require(fix[ilk] != 0, "End/fix-ilk-not-defined");
    let (fix) = _fix.read(ilk);
    with_attr error_message("End/fix-ilk-already-defined") {
        assert_not_0(fix);
    }
    let (vat) = _vat.read();
    let (self) = get_contract_address();
    let (sender) = get_caller_address();
    let (new_fix) = rmul(wad, fix);
    // vat.flux(ilk, address(this), msg.sender, rmul(wad, fix[ilk]));
    VatLike.flux(vat, ilk, self, sender, new_fix);
    // out[ilk][msg.sender] = out[ilk][msg.sender] + wad;
    let (out) = _out.read(ilk, sender);
    let (new_out) = add(out, wad);
    _out.write(ilk, sender, new_out);
    // require(out[ilk][msg.sender] <= bag[msg.sender], "End/insufficient-bag-balance");
    with_attr error_message("End/insufficient-bag-balance") {
        let (bag) = _bag.read(sender);
        assert_le(new_out, bag);
    }
    // emit Cash(ilk, msg.sender, wad);
    Cash.emit(ilk, sender, wad);
    return ();
}
