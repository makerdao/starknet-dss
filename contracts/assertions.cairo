from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.math import assert_not_zero
from starkware.cairo.common.math_cmp import is_le_felt
from starkware.cairo.common.uint256 import (
    Uint256,
    uint256_eq,
    uint256_lt,
    uint256_signed_le,
    uint256_le,
    uint256_check,
)
from safe_math import Int256

func either(a: felt, b: felt) -> (res: felt) {
    if (a + b == 0) {
        return (0,);
    }
    return (1,);
}

func assert_either(a: felt, b: felt) {
    if (a + b == 0) {
        assert 1 = 0;
    }
    return ();
}

func both(a: felt, b: felt) -> (res: felt) {
    if (a + b == 2) {
        return (1,);
    }
    return (0,);
}

func assert_both(a: felt, b: felt) {
    assert a + b = 2;
    return ();
}

func not_0(a: Uint256) -> (res: felt) {
    if (a.low + a.high == 0) {
        return (0,);
    }
    return (1,);
}

func assert_not_0(a: Uint256) {
    assert_not_zero(a.low + a.high);
    return ();
}

func assert_0(a: Uint256) {
    assert a.low + a.high = 0;
    return ();
}

func ge{range_check_ptr}(a: Uint256, b: Uint256) -> (res: felt) {
    let (lt: felt) = uint256_lt(a, b);
    return (res=1 - lt);
}

// signed!
func _ge_0{range_check_ptr}(a: Int256) -> (res: felt) {
    let (res) = uint256_signed_le(Uint256(low=0, high=0), a);
    return (res,);
}

func le{range_check_ptr}(a: Uint256, b: Uint256) -> (res: felt) {
    alloc_locals;
    let (local lt) = uint256_lt(a, b);
    let (eq) = uint256_eq(a, b);
    if (lt + eq == 0) {
        return (0,);
    } else {
        return (1,);
    }
}

func _le{range_check_ptr}(a: Int256, b: Int256) -> (res: felt) {
    alloc_locals;
    let (local lt) = uint256_signed_le(a, b);
    let (eq) = uint256_eq(a, b);
    if (lt + eq == 0) {
        return (0,);
    } else {
        return (1,);
    }
}

func assert_le{range_check_ptr}(a: Uint256, b: Uint256) -> () {
    let (is_le) = uint256_le(a, b);
    assert is_le = 1;
    return ();
}

// signed!
func _le_0{range_check_ptr}(a: Int256) -> (res: felt) {
    let (res) = uint256_signed_le(a, Uint256(low=0, high=0));
    return (res,);
}

func eq_0(a: Uint256) -> (res: felt) {
    if (a.low + a.high == 0) {
        return (1,);
    }
    return (0,);
}

func check{range_check_ptr}(a: Uint256) {
    with_attr error_message("invalid amount") {
        uint256_check(a);
    }
    return ();
}

func is_lt{syscall_ptr: felt*, range_check_ptr}(lhs: felt, rhs: felt) -> (res: felt) {
    if (rhs == 0) {
        return (0,);
    }
    let res: felt = is_le_felt(lhs, rhs - 1);
    return (res,);
}

func is_eq(a: felt, b: felt) -> (res: felt) {
    if (a == b) {
        return (1,);
    } else {
        return (0,);
    }
}

func is_zero(value) -> (res: felt) {
    if (value == 0) {
        return (res=1);
    }

    return (res=0);
}
