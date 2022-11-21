%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256
from contracts.starknet.safe_math import mul, div_rem
from starkware.starknet.common.syscalls import get_caller_address

// interface VatLike {
//     function file(bytes32, bytes32, uint) external;
// }
@contract_interface
namespace VatLike {
    func file_ilk(ilk: felt, what: felt, data: Uint256) -> () {
    }
}

// interface PipLike {
//     function peek() external returns (bytes32, bool);
// }
@contract_interface
namespace PipLike {
    func peek() -> (val: Uint256, res: felt) {
    }
}

// struct Ilk {
//     PipLike pip;  // Price Feed
//     uint256 mat;  // Liquidation ratio [ray]
// }
struct Ilk {
    pip: felt,
    mat: Uint256,
}

// mapping (address => uint256) public wards;
@storage_var
func _wards(user: felt) -> (res: felt) {
}

// uint256 public live;
@storage_var
func _live() -> (res: felt) {
}

// uint256 public par;  // ref per dai [ray]
@storage_var
func _par() -> (res: Uint256) {
}

// mapping (bytes32 => Ilk) public ilks;
@storage_var
func _ilks(ilk: felt) -> (res: Ilk) {
}

// VatLike public immutable vat;  // CDP Engine
@storage_var
func _vat() -> (res: felt) {
}

const RAY = 10 ** 27;

@view
func live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _live.read();
    return (res,);
}

// event Rely(address indexed usr);
@event
func Rely(user: felt) {
}

// event Deny(address indexed usr);
@event
func Deny(user: felt) {
}

// event File(bytes32 indexed ilk, bytes32 indexed what, address data);
@event
func File_pip(ilk: felt, what: felt, data: felt) {
}
// event File(bytes32 indexed what, uint256 data);
@event
func File_par(what: felt, data: Uint256) {
}
// event File(bytes32 indexed ilk, bytes32 indexed what, uint256 data);
@event
func File_mat(ilk: felt, what: felt, data: Uint256) {
}
// event Cage();
@event
func Cage() {
}
// event Poke(
//   bytes32 ilk,
//   bytes32 val,  // [wad]
//   uint256 spot  // [ray]
// );
@event
func Poke(ilk: felt, val: Uint256, spot: Uint256) {
}

func require_live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    // require(live == 1, "Spotter/not-live");
    with_attr error_message("Spotter/not-live") {
        let (live) = _live.read();
        assert live = 1;
    }

    return ();
}

// modifier auth {
//     require(wards[msg.sender] == 1, "Spotter/not-authorized");
//     _;
// }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (ward) = _wards.read(caller);
    with_attr error_message("Spotter/not-authorized") {
        assert ward = 1;
    }
    return ();
}

@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    vat: felt, ward: felt
) {
    // wards[msg.sender] = 1;
    _wards.write(ward, 1);
    // vat = VatLike(vat_);
    _vat.write(vat);
    // par = RAY;
    _par.write(Uint256(RAY, 0));
    // live = 1;
    _live.write(1);
    // emit Rely(msg.sender);
    Rely.emit(ward);

    return ();
}

// function cage() external auth {
//         live = 0;
//         emit Cage();
//     }
@external
func cage{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    _live.write(0);
    return ();
}

// function rely(address usr) external auth {
//         wards[usr] = 1;
//         emit Rely(usr);
//     }
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();
    _wards.write(usr, 1);
    Rely.emit(usr);
    return ();
}

// function deny(address usr) external auth {
//     wards[usr] = 0;
//     emit Deny(usr);
// }
@external
func deny{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();
    _wards.write(usr, 0);
    Deny.emit(usr);
    return ();
}

// function file(bytes32 ilk, bytes32 what, address data) external auth {
//         require(live == 1, "Spotter/not-live");
//         if (what == "pip") ilks[ilk].pip = PipLike(data);
//         else revert("Spotter/file-unrecognized-param");
//         emit File(ilk, what, data);
//     }
@external
func file_pip{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    ilk: felt, what: felt, data: felt
) {
    require_live();
    with_attr error_message("Spotter/file-unrecognized-param") {
        assert what = 'pip';
    }
    let (_ilk) = _ilks.read(ilk);
    _ilks.write(ilk, Ilk(pip=data, mat=_ilk.mat));
    return ();
}

// function file(bytes32 what, uint256 data) external auth {
//     require(live == 1, "Spotter/not-live");
//     if (what == "par") par = data;
//     else revert("Spotter/file-unrecognized-param");
//     emit File(what, data);
// }
@external
func file_par{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    what: felt, data: Uint256
) {
    require_live();
    with_attr error_message("Spotter/file-unrecognized-param") {
        assert what = 'par';
    }
    _par.write(data);
    return ();
}

// function file(bytes32 ilk, bytes32 what, uint256 data) external auth {
//     require(live == 1, "Spotter/not-live");
//     if (what == "mat") ilks[ilk].mat = data;
//     else revert("Spotter/file-unrecognized-param");
//     emit File(ilk, what, data);
// }
@external
func file_mat{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    ilk: felt, what: felt, data: Uint256
) {
    require_live();
    with_attr error_message("Spotter/file-unrecognized-param") {
        assert what = 'mat';
    }
    let (_ilk) = _ilks.read(ilk);
    _ilks.write(ilk, Ilk(pip=_ilk.pip, mat=data));
    return ();
}

// --- Update value ---
// function poke(bytes32 ilk) external {
//   (bytes32 val, bool has) = ilks[ilk].pip.peek();
//   uint256 spot = has
//                   ? (uint256(val) * 10 ** 9 * RAY / par) * RAY / ilks[ilk].mat
//                   : 0;
//   vat.file(ilk, "spot", spot);
//   emit Poke(ilk, val, spot);
// }
@external
func poke{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ilk: felt) {
    alloc_locals;
    let (_ilk) = _ilks.read(ilk);
    let (val: Uint256, has: felt) = PipLike.peek(_ilk.pip);

    let (par) = _par.read();

    let (inter) = mul(val, Uint256(10 ** 9 * RAY, 0));
    let (inter2, _) = div_rem(inter, par);
    let (inter3) = mul(inter2, Uint256(RAY, 0));
    let (spot, _) = div_rem(inter3, _ilk.mat);

    let (vat) = _vat.read();
    VatLike.file_ilk(vat, ilk, 'spot', spot);

    Poke.emit(ilk, val, spot);
    return ();
}
