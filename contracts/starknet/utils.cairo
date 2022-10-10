# https://github.com/briqNFT/briq-protocol/blob/main/contracts/UInt256_felt_conv.cairo
%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.math import (
    assert_nn_le,
    assert_lt,
    assert_le,
    assert_not_zero,
    assert_lt_felt,
    unsigned_div_rem,
)
from starkware.cairo.common.math import split_felt
from starkware.cairo.common.uint256 import Uint256

func _uint_to_felt{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    value : Uint256
) -> (value : felt):
    assert_lt_felt(value.high, 2 ** 123)
    return (value.high * (2 ** 128) + value.low)
end

func _felt_to_uint{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    value : felt
) -> (value : Uint256):
    let (high, low) = split_felt(value)
    tempvar res : Uint256
    res.high = high
    res.low = low
    return (res)
end

func is_zero(value) -> (res : felt):
    if value == 0:
        return (res=1)
    end

    return (res=0)
end

func is_equal(a : felt, b : felt) -> (res : felt):
    if a == b:
        return (1)
    else:
        return (0)
    end
end
