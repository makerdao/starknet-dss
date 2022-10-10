from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import (
    Uint256,
    uint256_add,
    uint256_sub,
    uint256_mul,
    uint256_eq,
    uint256_le,
    uint256_check,
    uint256_signed_nn,
    uint256_cond_neg,
    uint256_neg,
    uint256_unsigned_div_rem,
)

const MASK128 = 2 ** 128 - 1;
const BOUND128 = 2 ** 128;

using Int256 = Uint256;

// See: https://en.wikipedia.org/wiki/Two%27s_complement

// unsigned wad + unsigned wad -> unsigned wad
func add{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(lhs: Uint256, rhs: Uint256) -> (
    res: Uint256
) {
    let (res: Uint256, carry: felt) = uint256_add(lhs, rhs);
    assert carry = 0;
    return (res,);
}

// unsigned wad - unsigned wad -> unsigned wad
func sub{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(lhs: Uint256, rhs: Uint256) -> (
    res: Uint256
) {
    let (safe) = uint256_le(rhs, lhs);
    assert safe = 1;
    // preemptively borrow from bit128
    let (low_safe) = bitwise_and(BOUND128 + lhs.low - rhs.low, MASK128);
    let low_unsafe = lhs.low - rhs.low;
    if (low_safe == low_unsafe) {
        // the borrow was not used
        return (Uint256(low_safe, lhs.high - rhs.high),);
    } else {
        // the borrow was used
        return (Uint256(low_safe, lhs.high - rhs.high - 1),);
    }
}

// unsigned wad * unsigned wad -> unsigned wad
func mul{range_check_ptr}(lhs: Uint256, rhs: Uint256) -> (res: Uint256) {
    let (result: Uint256, overflow: Uint256) = uint256_mul(lhs, rhs);
    assert overflow.low = 0;
    assert overflow.high = 0;
    return (result,);
}

func add_signed{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(lhs: Int256, rhs: Int256) -> (
    res: Int256
) {
    let (lhs_extend) = bitwise_and(lhs.high, 0x80000000000000000000000000000000);
    let (rhs_extend) = bitwise_and(rhs.high, 0x80000000000000000000000000000000);
    let (res: Uint256, carry: felt) = uint256_add(lhs, rhs);
    let carry_extend = lhs_extend + rhs_extend + carry * 0x80000000000000000000000000000000;
    let (msb) = bitwise_and(res.high, 0x80000000000000000000000000000000);
    let (carry_lsb) = bitwise_and(carry_extend, 0x80000000000000000000000000000000);
    assert msb = carry_lsb;
    return (res,);
}

// unsigned wad + signed wad -> unsigned wad
// function _add(uint256 x, int256 y) internal pure returns (uint256 z) {
//     z = y >= 0 ? x + uint256(y) : x - uint256(-y);
// }
func _add{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(x: Uint256, y: Int256) -> (res: Uint256) {
    let (y_nn) = uint256_signed_nn(y);
    if (y_nn == 1) {
        let (res) = add(x, y);
        return (res,);
    }

    let (minus_y) = uint256_neg(y);
    let (res) = sub(x, minus_y);
    return (res,);
}

// unsigned - signed -> unsigned wad
// function _sub(uint256 x, int256 y) internal pure returns (uint256 z) {
//     z = y >= 0 ? x - uint256(y) : x + uint256(-y);
// }
func _sub{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(x: Uint256, y: Int256) -> (res: Uint256) {
    let (y_nn) = uint256_signed_nn(y);
    if (y_nn == 1) {
        let (res) = sub(x, y);
        return (res,);
    }

    let (minus_y) = uint256_neg(y);
    let (res) = add(x, minus_y);
    return (res,);
}

// unsigned * signed -> signed wad
func _mul{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(lhs: Uint256, rhs: Int256) -> (
    res: Int256
) {
    alloc_locals;
    let (lhs_nn) = uint256_signed_nn(lhs);
    assert lhs_nn = 1;
    let (local rhs_nn) = uint256_signed_nn(rhs);
    // TODO: since lhs_nn = 1 line below is unnecesary
    let (lhs_abs) = uint256_cond_neg(lhs, 1 - lhs_nn);
    let (rhs_abs) = uint256_cond_neg(rhs, 1 - rhs_nn);
    let (res_abs, overflow) = uint256_mul(lhs_abs, rhs_abs);
    assert overflow.low = 0;
    assert overflow.high = 0;
    let (msb) = bitwise_and(res_abs.high, 0x80000000000000000000000000000000);
    assert msb = 0;
    let (res) = uint256_cond_neg(res_abs, (lhs_nn + rhs_nn) * (2 - lhs_nn - rhs_nn));
    return (res,);
}

func div_rem{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    a: Uint256, b: Uint256
) -> (c: Uint256, rem: Uint256) {
    alloc_locals;
    uint256_check(a);
    uint256_check(b);

    let (is_zero) = uint256_eq(b, Uint256(0, 0));
    with_attr error_message("SafeUint256: divisor cannot be zero") {
        assert is_zero = 0;
    }

    let (c: Uint256, rem: Uint256) = uint256_unsigned_div_rem(a, b);
    return (c, rem);
}
