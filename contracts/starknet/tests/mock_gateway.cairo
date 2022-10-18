%lang starknet

from contracts.starknet.teleport_GUID import TeleportGUID
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.cairo_builtins import HashBuiltin

@external
func registerMint{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    teleportGUID: TeleportGUID
) {
    return ();
}

@external
func settle{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    source_domain: felt, target_domain: felt, amount: Uint256
) {
    return ();
}

@external
func request_mint{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    teleportGUID: TeleportGUID, max_fee_percentage: Uint256, operator_fee: Uint256
) -> (post_fee_amount: Uint256, operator_fee: Uint256) {
    return (Uint256(0, 0), Uint256(0, 0));
}
