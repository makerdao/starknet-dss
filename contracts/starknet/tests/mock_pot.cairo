%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256

@storage_var
func _live() -> (res: felt) {
}

@storage_var
func _vat() -> (res: felt) {
}

@storage_var
func _vow() -> (res: felt) {
}

@storage_var
func _dsr() -> (res: Uint256) {
}

const RAY = 10 ** 27;

func require_live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    // require(live == 1, "End/not-live");
    with_attr error_message("Pot/not-live") {
        let (live) = _live.read();
        assert live = 1;
    }

    return ();
}

@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    vat: felt, vow: felt
) {
    _vat.write(vat);
    _vow.write(vow);
    _live.write(1);
    return ();
}

@external
func cage{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    _live.write(0);
    _dsr.write(Uint256(RAY, 0));
    return ();
}

@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(user: felt) {
    // require(live == 1, "Pot/not-live");
    require_live();

    return ();
}
