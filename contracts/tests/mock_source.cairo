%lang starknet

from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin

@storage_var
func _cure() -> (cure: Uint256) {
}

@view
func cure{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (cure: Uint256) {
    let (cure) = _cure.read();
    return (cure,);
}

@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(cure_: Uint256) {
    _cure.write(cure_);

    return ();
}

@external
func update{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(cure_: Uint256) {
    _cure.write(cure_);
    return ();
}
