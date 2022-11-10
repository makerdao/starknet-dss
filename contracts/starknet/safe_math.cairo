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
    uint256_not,
)
from starkware.cairo.common.math import assert_lt, assert_lt_felt, split_felt

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

func sub_signed256{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(lhs: Int256, rhs: Int256) -> (
    res: Uint256
) {
    // First sign extend both operands
    let (left_msb: felt) = bitwise_and(lhs.high, 0x80000000000000000000000000000000);
    let (right_msb: felt) = bitwise_and(rhs.high, 0x80000000000000000000000000000000);
    let left_overflow: felt = left_msb / 0x80000000000000000000000000000000;
    let right_overflow: felt = right_msb / 0x80000000000000000000000000000000;

    // Now safely negate the rhs and add (l - r = l + (-r))
    let (right_flipped: Uint256) = uint256_not(rhs);
    let (right_neg, overflow) = uint256_add(right_flipped, Uint256(1, 0));
    let right_overflow_neg = overflow + 1 - right_overflow;
    let (res, res_base_overflow) = uint256_add(lhs, right_neg);
    let res_overflow = res_base_overflow + left_overflow + right_overflow_neg;

    // Check if the result fits in the correct width
    let (res_msb: felt) = bitwise_and(res.high, 0x80000000000000000000000000000000);
    let (res_overflow_lsb: felt) = bitwise_and(res_overflow, 1);
    assert res_overflow_lsb * 0x80000000000000000000000000000000 = res_msb;

    // Narrow and return
    return (res=res);
}

func add_signed256{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(lhs: Int256, rhs: Int256) -> (
    res: Uint256
) {
    let (lhs_extend) = bitwise_and(lhs.high, 0x80000000000000000000000000000000);
    let (rhs_extend) = bitwise_and(rhs.high, 0x80000000000000000000000000000000);
    let (res: Uint256, carry: felt) = uint256_add(lhs, rhs);
    let carry_extend = lhs_extend + rhs_extend + carry * 0x80000000000000000000000000000000;
    let (msb) = bitwise_and(res.high, 0x80000000000000000000000000000000);
    let (carry_lsb) = bitwise_and(carry_extend, 0x80000000000000000000000000000000);
    assert msb = carry_lsb;
    return (res=res);
}

func mul_signed256{range_check_ptr, bitwise_ptr: BitwiseBuiltin*}(lhs: Uint256, rhs: Uint256) -> (
    result: Uint256
) {
    alloc_locals;
    // 1 => lhs >= 0, 0 => lhs < 0
    let (lhs_nn) = uint256_signed_nn(lhs);
    // 1 => rhs >= 0, 0 => rhs < 0
    let (local rhs_nn) = uint256_signed_nn(rhs);
    // negates if arg is 1, which is if lhs_nn is 0, which is if lhs < 0
    let (lhs_abs) = uint256_cond_neg(lhs, 1 - lhs_nn);
    // negates if arg is 1
    let (rhs_abs) = uint256_cond_neg(rhs, 1 - rhs_nn);
    let (res_abs, overflow) = uint256_mul(lhs_abs, rhs_abs);
    assert overflow.low = 0;
    assert overflow.high = 0;
    let res_should_be_neg = lhs_nn + rhs_nn;
    if (res_should_be_neg == 1) {
        let (in_range) = uint256_le(res_abs, Uint256(0, 0x80000000000000000000000000000000));
        assert in_range = 1;
        let (negated) = uint256_neg(res_abs);
        return (result=negated);
    } else {
        let (msb) = bitwise_and(res_abs.high, 0x80000000000000000000000000000000);
        assert msb = 0;
        return (result=res_abs);
    }
}

// // --- Math ---
//     uint256 constant WAD = 10 ** 18;
//     uint256 constant RAY = 10 ** 27;
//     function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
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

func _uint_to_felt{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    value: Uint256
) -> (value: felt) {
    assert_lt_felt(value.high, 2 ** 123);
    return (value.high * (2 ** 128) + value.low,);
}

func _felt_to_uint{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    value: felt
) -> (value: Uint256) {
    let (high, low) = split_felt(value);
    tempvar res: Uint256;
    res.high = high;
    res.low = low;
    return (res,);
}

func div{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    a: Uint256, b: Uint256
) -> (c: Uint256) {
    alloc_locals;
    uint256_check(a);
    uint256_check(b);

    let (is_zero) = uint256_eq(b, Uint256(0, 0));
    with_attr error_message("SafeUint256: divisor cannot be zero") {
        assert is_zero = 0;
    }

    let (c: Uint256, rem: Uint256) = uint256_unsigned_div_rem(a, b);
    return (c,);
}

struct Wad {
    wad: Uint256,
}

struct Ray {
    ray: Uint256,
}

// WAD = 1 * 10 ^ 18
const WAD = 10 ** 18;
const HALF_WAD = WAD / 2;

// RAY = 1 * 10 ^ 27
const RAY = 10 ** 27;
const HALF_RAY = RAY / 2;

const UINT128_MAX = 2 ** 128 - 1;

// WAD_RAY_RATIO = 1 * 10 ^ 9
const WAD_RAY_RATIO = 10 ** 9;
const HALF_WAD_RAY_RATION = WAD_RAY_RATIO / 2;

func ray() -> (ray: Ray) {
    return (Ray(Uint256(RAY, 0)),);
}

func wad() -> (wad: Wad) {
    return (Wad(Uint256(WAD, 0)),);
}

func half_ray() -> (half_ray: Ray) {
    return (Ray(Uint256(HALF_RAY, 0)),);
}

func half_wad() -> (half_wad: Wad) {
    return (Wad(Uint256(HALF_WAD, 0)),);
}

func wad_ray_ratio() -> (ratio: Uint256) {
    return (Uint256(WAD_RAY_RATIO, 0),);
}

func half_wad_ray_ratio() -> (ratio: Uint256) {
    return (Uint256(HALF_WAD_RAY_RATION, 0),);
}

func uint256_max() -> (max: Uint256) {
    return (Uint256(UINT128_MAX, UINT128_MAX),);
}

func wad_mul{range_check_ptr}(a: Wad, b: Wad) -> (res: Wad) {
    alloc_locals;
    if (a.wad.high + a.wad.low == 0) {
        return (Wad(Uint256(0, 0)),);
    }
    if (b.wad.high + b.wad.low == 0) {
        return (Wad(Uint256(0, 0)),);
    }

    let (UINT256_MAX) = uint256_max();
    let (HALF_WAD_UINT) = half_wad();
    let (WAD_UINT) = wad();

    with_attr error_message("WAD multiplication overflow") {
        let (bound) = uint256_sub(UINT256_MAX, HALF_WAD_UINT.wad);
        let (quotient, rem) = uint256_unsigned_div_rem(bound, b.wad);
        let (le) = uint256_le(a.wad, quotient);
        assert le = 1;
    }

    let (ab, _) = uint256_mul(a.wad, b.wad);
    let (abHW, _) = uint256_add(ab, HALF_WAD_UINT.wad);
    let (res, _) = uint256_unsigned_div_rem(abHW, WAD_UINT.wad);
    return (Wad(res),);
}

func wad_div{range_check_ptr}(a: Wad, b: Wad) -> (res: Wad) {
    alloc_locals;
    with_attr error_message("WAD divide by zero") {
        if (b.wad.high + b.wad.low == 0) {
            assert 1 = 0;
        }
    }

    let (halfB, _) = uint256_unsigned_div_rem(b.wad, Uint256(2, 0));

    let (UINT256_MAX) = uint256_max();
    let (WAD_UINT) = wad();

    with_attr error_message("WAD div overflow") {
        let (bound) = uint256_sub(UINT256_MAX, halfB);
        let (quo, _) = uint256_unsigned_div_rem(bound, WAD_UINT.wad);
        let (le) = uint256_le(a.wad, quo);
        assert le = 1;
    }

    let (aWAD, _) = uint256_mul(a.wad, WAD_UINT.wad);
    let (aWADHalfB, _) = uint256_add(aWAD, halfB);
    let (res, _) = uint256_unsigned_div_rem(aWADHalfB, b.wad);
    return (Wad(res),);
}

func wad_add{range_check_ptr}(a: Wad, b: Wad) -> (res: Wad, overflow: felt) {
    let (sum, overflow) = uint256_add(a.wad, b.wad);
    return (Wad(sum), overflow);
}

func wad_sub{range_check_ptr}(a: Wad, b: Wad) -> (res: Wad) {
    let (diff) = uint256_sub(a.wad, b.wad);
    return (Wad(diff),);
}

func ray_mul{range_check_ptr}(a: Ray, b: Ray) -> (res: Ray) {
    alloc_locals;
    if (a.ray.high + a.ray.low == 0) {
        return (Ray(Uint256(0, 0)),);
    }
    if (b.ray.high + b.ray.low == 0) {
        return (Ray(Uint256(0, 0)),);
    }

    let (UINT256_MAX) = uint256_max();
    let (HALF_RAY_UINT) = half_ray();
    let (RAY_UINT) = ray();

    with_attr error_message("RAY div overflow") {
        let (bound) = uint256_sub(UINT256_MAX, HALF_RAY_UINT.ray);
        let (quotient, rem) = uint256_unsigned_div_rem(bound, b.ray);
        let (le) = uint256_le(a.ray, quotient);
        assert le = 1;
    }

    let (ab, _) = uint256_mul(a.ray, b.ray);
    let (abHR, _) = uint256_add(ab, HALF_RAY_UINT.ray);
    let (res, _) = uint256_unsigned_div_rem(abHR, RAY_UINT.ray);
    return (Ray(res),);
}

func ray_div{range_check_ptr}(a: Ray, b: Ray) -> (res: Ray) {
    alloc_locals;
    with_attr error_message("RAY divide by zero") {
        if (b.ray.high + b.ray.low == 0) {
            assert 1 = 0;
        }
    }

    let (halfB, _) = uint256_unsigned_div_rem(b.ray, Uint256(2, 0));

    let (UINT256_MAX) = uint256_max();
    let (RAY_UINT) = ray();

    with_attr error_message("RAY multiplication overflow") {
        let (bound) = uint256_sub(UINT256_MAX, halfB);
        let (quo, _) = uint256_unsigned_div_rem(bound, RAY_UINT.ray);
        let (le) = uint256_le(a.ray, quo);
        assert le = 1;
    }

    let (aRAY, _) = uint256_mul(a.ray, RAY_UINT.ray);
    let (aRAYHalfB, _) = uint256_add(aRAY, halfB);
    let (res, _) = uint256_unsigned_div_rem(aRAYHalfB, b.ray);
    return (Ray(res),);
}

func ray_to_wad{range_check_ptr}(a: Ray) -> (res: Wad) {
    alloc_locals;
    let (HALF_WAD_RAY_RATIO_UINT) = half_wad_ray_ratio();
    let (WAD_RAY_RATIO_UINT) = wad_ray_ratio();

    let (res, overflow) = uint256_add(a.ray, HALF_WAD_RAY_RATIO_UINT);
    with_attr error_message("ray_to_wad overflow") {
        assert overflow = 0;
    }
    let (res, _) = uint256_unsigned_div_rem(res, WAD_RAY_RATIO_UINT);
    return (Wad(res),);
}

func wad_to_ray{range_check_ptr}(a: Wad) -> (res: Ray) {
    alloc_locals;
    let (WAD_RAY_RATIO_UINT) = wad_ray_ratio();

    let (res, overflow) = uint256_mul(a.wad, WAD_RAY_RATIO_UINT);
    with_attr error_message("wad_to_ray overflow") {
        assert overflow.high + overflow.low = 0;
    }
    return (Ray(res),);
}

func ray_mul_no_rounding{range_check_ptr}(a: Ray, b: Ray) -> (res: Ray) {
    alloc_locals;
    if (a.ray.high + a.ray.low == 0) {
        return (Ray(Uint256(0, 0)),);
    }
    if (b.ray.high + b.ray.low == 0) {
        return (Ray(Uint256(0, 0)),);
    }

    let (RAY_UINT) = ray();

    let (ab, overflow) = uint256_mul(a.ray, b.ray);
    with_attr error_message("ray_mul_no_rounding overflow") {
        assert overflow.high = 0;
        assert overflow.low = 0;
    }
    let (res, _) = uint256_unsigned_div_rem(ab, RAY_UINT.ray);
    return (Ray(res),);
}

func ray_div_no_rounding{range_check_ptr}(a: Ray, b: Ray) -> (res: Ray) {
    alloc_locals;
    with_attr error_message("RAY divide by zero") {
        if (b.ray.high + b.ray.low == 0) {
            assert 1 = 0;
        }
    }

    let (RAY_UINT) = ray();

    let (aRAY, overflow) = uint256_mul(a.ray, RAY_UINT.ray);
    with_attr error_message("ray_div_no_rounding overflow") {
        assert overflow.high = 0;
        assert overflow.low = 0;
    }
    let (res, _) = uint256_unsigned_div_rem(aRAY, b.ray);
    return (Ray(res),);
}

func ray_to_wad_no_rounding{range_check_ptr}(a: Ray) -> (res: Wad) {
    let (WAD_RAY_RATIO_UINT) = wad_ray_ratio();
    let (res, _) = uint256_unsigned_div_rem(a.ray, WAD_RAY_RATIO_UINT);
    return (Wad(res),);
}

func ray_add{range_check_ptr}(a: Ray, b: Ray) -> (res: Ray, overflow: felt) {
    let (sum, overflow) = uint256_add(a.ray, b.ray);
    return (Ray(sum), overflow);
}

func ray_sub{range_check_ptr}(a: Ray, b: Ray) -> (res: Ray) {
    let (diff) = uint256_sub(a.ray, b.ray);
    return (Ray(diff),);
}

func wad_le{range_check_ptr}(a: Wad, b: Wad) -> (res: felt) {
    let a_wad = a.wad;
    let b_wad = b.wad;
    let (res) = uint256_le(a_wad, b_wad);
    return (res,);
}
