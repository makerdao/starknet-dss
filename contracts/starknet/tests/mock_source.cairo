%lang starknet

from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin

@storage_var
func _cure() -> (cure : Uint256):
end

@constructor
func constructor{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    cure_ : Uint256
):
    _cure.write(cure_)

    return ()
end

@external
func update{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(cure_ : Uint256):
    _cure.write(cure_)
    return ()
end
