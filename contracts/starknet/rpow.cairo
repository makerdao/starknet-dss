from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256, uint256_eq
from contracts.starknet.assertions import _ge_0, assert_0, eq_0
from contracts.starknet.safe_math import Int256, add, _felt_to_uint, div_rem, mul, div, _sub

// function _rpow(uint256 x, uint256 n, uint256 b) internal pure returns (uint256 z) {
//       assembly {
//         switch x case 0 {switch n case 0 {z := b} default {z := 0}}
//         default {
//           switch mod(n, 2) case 0 { z := b } default { z := x }
//           let half := div(b, 2)  // for rounding.
//           for { n := div(n, 2) } n { n := div(n,2) } {
//             let xx := mul(x, x)
//             if iszero(eq(div(xx, x), x)) { revert(0,0) }
//             let xxRound := add(xx, half)
//             if lt(xxRound, xx) { revert(0,0) }
//             x := div(xxRound, b)
//             if mod(n,2) {
//               let zx := mul(z, x)
//               if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
//               let zxRound := add(zx, half)
//               if lt(zxRound, zx) { revert(0,0) }
//               z := div(zxRound, b)
//             }
//           }
//         }
//       }
//     }
func _rpow{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(x: Uint256, n: Uint256, b: Uint256) -> (z: Uint256) {
    alloc_locals;
    let (is_x_null) = eq_0(x);
    let (is_n_null) = eq_0(n);

    if (is_x_null == 1) {
        if (is_n_null == 1) {
            return (z=b);
        } else {
            return (z=Uint256(0, 0));
        }
    } else {
        let (_, mod_2_n) = div_rem(n, Uint256(2, 0));
        let (is_mod_null) = eq_0(mod_2_n);
        let (_z) = get_z(b, x, is_mod_null);
        let (half, _) = div_rem(b, Uint256(2, 0));
        let (init_n, _) = div_rem(n, Uint256(2, 0));
        let (end_z) = _loop(x, init_n, half, _z, b);
        return (z=end_z,);
    }
}

func get_z{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    b: Uint256, x: Uint256, condition
) -> (z: Uint256) {
    if (condition == 1) {
        return (z=b);
    } else {
        return (z=x);
    }
}

func _loop{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(x: Uint256, n: Uint256, half: Uint256, z: Uint256, b: Uint256) -> (new_z: Uint256) {
    alloc_locals;
    let (stop) = eq_0(n);
    if (stop == 1) {
        return (z,);
    }

    let (xx) = mul(x, x);
    let (xxRound) = add(xx, half);
    let (new_x, _) = div_rem(xxRound, b);
    let (new_n, mod_2) = div_rem(n, Uint256(2, 0));
    let (is_odd) = uint256_eq(mod_2, Uint256(1, 0));
    // let (is_even) = bitwise_and(new_x, Uint256(0, 0))
    if (is_odd == 1) {
        let (zx) = mul(z, new_x);
        // let (is_x_positive) = uint256_lt(Uint256(0, 0), new_x)
        // let (check_overflow, _) = div_rem(zx, x)
        // let (has_not_overflow) = uint256_eq(check_overflow, z)
        // with_attr error_message("overflow"):
        //     assert and(is_x_positive, 1 - has_not_overflow) = TRUE
        // end
        let (zxRound) = add(zx, half);
        let (new_z, _) = div_rem(zxRound, b);
        return _loop(new_x, new_n, half, new_z, b);
    } else {
        return _loop(new_x, new_n, half, z, b);
    }
}
