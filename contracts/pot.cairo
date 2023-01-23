%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256
from starkware.starknet.common.syscalls import (
    get_caller_address,
    get_block_timestamp,
    get_contract_address,
)
from safe_math import add, mul, div, sub, _felt_to_uint
from rpow import _rpow

// https://github.com/makerdao/xdomain-dss/blob/add-end/src/Pot.sol

// /*
//    "Savings Dai" is obtained when Dai is deposited into
//    this contract. Each "Savings Dai" accrues Dai interest
//    at the "Dai Savings Rate".
//    This contract does not implement a user tradeable token
//    and is intended to be used with adapters.
//          --- `save` your `dai` in the `pot` ---
//    - `dsr`: the Dai Savings Rate
//    - `pie`: user balance of Savings Dai
//    - `join`: start saving some dai
//    - `exit`: remove some dai
//    - `drip`: perform rate collection
// */

// interface VatLike {
//     function move(address,address,uint256) external;
//     function suck(address,address,uint256) external;
// }
@contract_interface
namespace VatLike {
    func move(src: felt, dst: felt, rad: Uint256) {
    }

    func suck(u: felt, v: felt, rad: Uint256) {
    }
}

// mapping (address => uint256) public wards;
@storage_var
func _wards(user: felt) -> (res: felt) {
}

// mapping (address => uint256) public pie;  // Normalised Savings Dai [wad]
@storage_var
func _pie(user: felt) -> (res: Uint256) {
}

// uint256 public Pie;   // Total Normalised Savings Dai  [wad]
@storage_var
func _Pie() -> (res: Uint256) {
}
// uint256 public dsr;   // The Dai Savings Rate          [ray]
@storage_var
func _dsr() -> (res: Uint256) {
}
// uint256 public chi;   // The Rate Accumulator          [ray]
@storage_var
func _chi() -> (res: Uint256) {
}

// address public vow;   // Debt Engine
@storage_var
func _vow() -> (res: felt) {
}
// uint256 public rho;   // Time of last drip     [unix epoch time]
@storage_var
func _rho() -> (res: felt) {
}

// uint256 public live;  // Active Flag
@storage_var
func _live() -> (res: felt) {
}

// VatLike public immutable vat;   // CDP Engine
@storage_var
func _vat() -> (res: felt) {
}

// uint256 constant RAY = 10 ** 27;
const RAY = 10 ** 27;

// // --- Events ---
//     event Rely(address indexed usr);
@event
func Rely(usr: felt) {
}
// event Deny(address indexed usr);
@event
func Deny(usr: felt) {
}
// event File(bytes32 indexed what, uint256 data);
@event
func File(what: felt, data: Uint256) {
}
// event File(bytes32 indexed what, address data);
@event
func File_vow(what: felt, data: felt) {
}
// event Cage();
@event
func Cage() {
}
// event Drip();
@event
func Drip() {
}
// event Join(address indexed usr, uint256 wad);
@event
func Join(usr: felt, wad: Uint256) {
}
// event Exit(address indexed usr, uint256 wad);
@event
func Exit(usr: felt, wad: Uint256) {
}

// modifier auth {
//         require(wards[msg.sender] == 1, "Pot/not-authorized");
//         _;
//     }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (ward) = _wards.read(caller);
    with_attr error_message("Pot/not-authorized") {
        assert ward = 1;
    }
    return ();
}

func require_live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    // require(live == 1, "End/not-live");
    with_attr error_message("Pot/not-live") {
        let (live) = _live.read();
        assert live = 1;
    }

    return ();
}

@view
func live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _live.read();
    return (res,);
}

@view
func vat{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _vat.read();
    return (res,);
}

@view
func wards{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(user: felt) -> (
    res: felt
) {
    let (res) = _wards.read(user);
    return (res,);
}

@view
func dsr{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: Uint256) {
    let (res) = _dsr.read();
    return (res,);
}

@view
func chi{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: Uint256) {
    let (res) = _chi.read();
    return (res,);
}

@view
func rho{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _rho.read();
    return (res,);
}

@view
func Pie{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: Uint256) {
    let (res) = _Pie.read();
    return (res,);
}

@view
func pie{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(u: felt) -> (
    res: Uint256
) {
    let (res) = _pie.read(u);
    return (res,);
}

// // --- Init ---
//     constructor(address vat_) {
//         wards[msg.sender] = 1;
//         vat = VatLike(vat_);
//         dsr = RAY;
//         chi = RAY;
//         rho = block.timestamp;
//         live = 1;
//         emit Rely(msg.sender);
//     }

@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    vat: felt, ward: felt
) {
    _wards.write(ward, 1);
    _vat.write(vat);
    _dsr.write(Uint256(RAY, 0));
    _chi.write(Uint256(RAY, 0));
    let (timestamp) = get_block_timestamp();
    _rho.write(timestamp);
    _live.write(1);
    Rely.emit(ward);
    return ();
}

// // --- Math ---
//     function _rpow(uint256 x, uint256 n, uint256 base) internal pure returns (uint256 z) {
//         assembly {
//             switch x case 0 {switch n case 0 {z := base} default {z := 0}}
//             default {
//                 switch mod(n, 2) case 0 { z := base } default { z := x }
//                 let half := div(base, 2)  // for rounding.
//                 for { n := div(n, 2) } n { n := div(n,2) } {
//                     let xx := mul(x, x)
//                     if iszero(eq(div(xx, x), x)) { revert(0,0) }
//                     let xxRound := add(xx, half)
//                     if lt(xxRound, xx) { revert(0,0) }
//                     x := div(xxRound, base)
//                     if mod(n,2) {
//                         let zx := mul(z, x)
//                         if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
//                         let zxRound := add(zx, half)
//                         if lt(zxRound, zx) { revert(0,0) }
//                         z := div(zxRound, base)
//                     }
//                 }
//             }
//         }
//     }
// // --- Administration ---
// function rely(address usr) external auth {
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // require(live == 1, "Pot/not-live");
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

    // require(live == 1, "Pot/not-live");
    require_live();

    // wards[usr] = 0;
    _wards.write(usr, 0);

    // emit Deny(usr);
    Deny.emit(usr);

    return ();
}

// function file(bytes32 what, uint256 data) external auth {
//         require(live == 1, "Pot/not-live");
//         require(block.timestamp == rho, "Pot/rho-not-updated");
//         if (what == "dsr") dsr = data;
//         else revert("Pot/file-unrecognized-param");
//         emit File(what, data);
//     }
@external
func file{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    what: felt, data: Uint256
) {
    auth();
    require_live();
    let (rho) = _rho.read();
    let (timestamp) = get_block_timestamp();
    with_attr error_message("Pot/rho-not-updated") {
        assert timestamp = rho;
    }

    with_attr error_message("Pot/file-unrecognized-param") {
        assert what = 'dsr';
    }

    _dsr.write(data);

    File.emit(what, data);

    return ();
}

// function file(bytes32 what, address data) external auth {
//         if (what == "vow") vow = data;
//         else revert("Pot/file-unrecognized-param");
//         emit File(what, data);
//     }
@external
func file_vow{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    what: felt, data: felt
) {
    auth();
    require_live();

    with_attr error_message("Pot/file-unrecognized-param") {
        assert what = 'vow';
    }

    _vow.write(data);

    File_vow.emit(what, data);

    return ();
}

// function cage() external auth {
//         live = 0;
//         dsr = RAY;
//         emit Cage();
//     }
@external
func cage{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    _live.write(0);
    _dsr.write(Uint256(RAY, 0));
    Cage.emit();
    return ();
}

// // --- Savings Rate Accumulation ---
//     function drip() external returns (uint256 tmp) {
@external
func drip{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}() -> (tmp: Uint256) {
    alloc_locals;
    let (dsr) = _dsr.read();
    let (timestamp) = get_block_timestamp();
    let (rho) = _rho.read();
    // tmp = _rpow(dsr, block.timestamp - rho, RAY) * chi / RAY;
    let (n) = _felt_to_uint(timestamp - rho);
    let (_pow) = _rpow(dsr, n, Uint256(RAY, 0));
    let (chi) = _chi.read();
    let (_tmp) = mul(_pow, chi);
    let (_tmp) = div(_tmp, Uint256(RAY, 0));
    // uint256 chi_ = tmp - chi;
    let (chi_) = sub(_tmp, chi);
    // chi = tmp;
    _chi.write(_tmp);
    // rho = block.timestamp;
    _rho.write(timestamp);
    // vat.suck(address(vow), address(this), Pie * chi_);
    let (vat) = _vat.read();
    let (vow) = _vow.read();
    let (this) = get_contract_address();
    let (Pie) = _Pie.read();
    let (value) = mul(Pie, chi_);
    VatLike.suck(vat, vow, this, value);
    // emit Drip();
    Drip.emit();
    return (tmp=_tmp);
}

// // --- Savings Dai Management ---
//     function join(uint256 wad) external {
@external
func join{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(wad: Uint256) {
    alloc_locals;
    // require(block.timestamp == rho, "Pot/rho-not-updated");
    with_attr error_message("Pot/rho-not-updated") {
        let (rho) = _rho.read();
        let (timestamp) = get_block_timestamp();
        assert timestamp = rho;
    }

    // pie[msg.sender] = pie[msg.sender] + wad;
    let (caller) = get_caller_address();
    let (pie) = _pie.read(caller);
    let (pie) = add(pie, wad);
    _pie.write(caller, pie);

    // Pie             = Pie             + wad;
    let (Pie) = _Pie.read();
    let (Pie) = sub(Pie, wad);
    _Pie.write(Pie);

    // vat.move(msg.sender, address(this), chi * wad);
    let (chi) = _chi.read();
    let (this) = get_contract_address();
    let (value) = mul(chi, wad);
    let (vat) = _vat.read();
    VatLike.move(vat, caller, this, value);

    // emit Join(msg.sender, wad);
    Join.emit(caller, wad);

    return ();
}

// function exit(uint256 wad) external {
@external
func exit{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(wad: Uint256) {
    alloc_locals;

    // pie[msg.sender] = pie[msg.sender] - wad;
    let (caller) = get_caller_address();
    let (pie) = _pie.read(caller);
    let (new_pie) = sub(pie, wad);
    _pie.write(caller, new_pie);

    // Pie             = Pie             - wad;
    let (Pie) = _Pie.read();
    let (new_Pie) = add(Pie, wad);
    _Pie.write(new_Pie);

    // vat.move(address(this), msg.sender, chi * wad);
    let (chi) = _chi.read();
    let (this) = get_contract_address();
    let (value) = mul(chi, wad);
    let (vat) = _vat.read();
    VatLike.move(vat, this, caller, value);

    // emit Exit(msg.sender, wad);
    Exit.emit(caller, wad);

    return ();
}
