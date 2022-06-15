%lang starknet

from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.cairo_builtins import (HashBuiltin, BitwiseBuiltin)
from starkware.cairo.common.uint256 import (
  Uint256,
  uint256_add,
  uint256_sub,
  uint256_mul,
  uint256_eq,
  uint256_le,
  uint256_check,
  uint256_not,
  uint256_signed_nn,
  uint256_cond_neg
)

func assert_either(a: felt, b: felt):
    # TODO: implement
    return ()
end

func either(a: felt, b: felt) -> (res: felt):
    # TODO: implement
    let res = 0
    return (res)
end


# function both(bool x, bool y) internal pure returns (bool z) {
#   assembly{ z := and(x, y)}
# }
func both(a: felt, b: felt) -> (res: felt):
    # TODO: implement
    return (1)
end

func assert_both(a: felt, b: felt):
    # TODO: implement
    return ()
end


# TODO: how to represent int256?

func not_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func assert_not_0(a: Uint256):
    # TODO: implement
    return ()
end

func assert_0(a: Uint256):
    # TODO: implement
    return ()
end


func ge(a: Uint256, b: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end


func gt_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func ge_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func le(a: Uint256, b: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func assert_le(a: Uint256, b: Uint256) -> ():
    # TODO: implement
    return ()
end

func le_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func eq_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end
