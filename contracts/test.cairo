# // SPDX-License-Identifier: GPL-3.0-or-later
# 
# // This program is free software: you can redistribute it and/or modify
# // it under the terms of the GNU General Public License as published by
# // the Free Software Foundation, either version 3 of the License, or
# // (at your option) any later version.
# 
# // This program is distributed in the hope that it will be useful,
# // but WITHOUT ANY WARRANTY; without even the implied warranty of
# // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# // GNU General Public License for more details.
# 
# // You should have received a copy of the GNU General Public License
# // along with this program.  If not, see <http://www.gnu.org/licenses/>.
# 
# pragma solidity >=0.5.0;
%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.math_cmp import (
  is_not_zero,
  is_le
)
from starkware.cairo.common.uint256 import (
  Uint256,
  uint256_sub
)

# contract DSTest {
#     event log                    (string);
#     event logs                   (bytes);
@event
func log(val : felt):
end
@event
func logs(val : felt):
end


#     event log_address            (address);
#     event log_bytes32            (bytes32);
#     event log_int                (int);
#     event log_uint               (uint);
#     event log_bytes              (bytes);
#     event log_string             (string);
@event
func log_address(res : felt):
end
@event
func log_bytes32(res : felt):
end
@event
func log_int(res : felt):
end
@event
func log_uint(res : Uint256):
end
@event
func log_bytes(res : felt):
end
@event
func log_string(res : felt):
end

#     event log_named_address      (string key, address val);
#     event log_named_bytes32      (string key, bytes32 val);
#     event log_named_decimal_int  (string key, int val, uint decimals);
#     event log_named_decimal_uint (string key, uint val, uint decimals);
#     event log_named_int          (string key, int val);
#     event log_named_uint         (string key, uint val);
#     event log_named_bytes        (string key, bytes val);
#     event log_named_string       (string key, string val);
@event
func log_named_felt(key : felt, val : felt):
end
@event
func log_named_uint256(key : felt, val : Uint256):
end
@event
func log_named_string(key : felt, val : felt):
end
@event
func log_named_decimals_int(key : felt, val : Uint256, decimals : felt):
end
@event
func log_named_decimals_uint(key : felt, val : Uint256, decimals : felt):
end
@event
func log_named_int(key : felt, val : Uint256):
end
@event
func log_named_uint(key : felt, val : Uint256):
end


#     bool public IS_TEST = true;
#     bool private _failed;
const IS_TEST = 1
@storage_var
func _failed() -> (res : felt):
end

#     address constant HEVM_ADDRESS =
#         address(bytes20(uint160(uint256(keccak256('hevm cheat code')))));
# TODO
const HEVM_ADDRESS = 0


#     modifier mayRevert() { _; }
#     modifier testopts(string memory) { _; }
# TODO


#     function failed() public returns (bool) {
#         if (_failed) {
#             return _failed;
#         } else {
#             bool globalFailed = false;
#             if (hasHEVMContext()) {
#                 (, bytes memory retdata) = HEVM_ADDRESS.call(
#                     abi.encodePacked(
#                         bytes4(keccak256("load(address,bytes32)")),
#                         abi.encode(HEVM_ADDRESS, bytes32("failed"))
#                     )
#                 );
#                 globalFailed = abi.decode(retdata, (bool));
#             }
#             return globalFailed;
#         }
#     } 
# func failed() -> (res : felt):
#   let (failed) = _failed.read()
#   if failed == 1:
#     return (failed)
#   else:
#     let globalFailed = false
#     if hasHEVMContext(): # TODO
#       let (res) = IHEVM(HEVM_ADDRESS).load(HEVM_ADDRESS, "failed")
#       globalFailed = # TODO
#     end
#     return (globalFailed)
#   end
# end


#     function fail() internal {
#         if (hasHEVMContext()) {
#             (bool status, ) = HEVM_ADDRESS.call(
#                 abi.encodePacked(
#                     bytes4(keccak256("store(address,bytes32,bytes32)")),
#                     abi.encode(HEVM_ADDRESS, bytes32("failed"), bytes32(uint256(0x01)))
#                 )
#             );
#             status; // Silence compiler warnings
#         }
#         _failed = true;
#     }
# 
#     function hasHEVMContext() internal view returns (bool) {
#         uint256 hevmCodeSize = 0;
#         assembly {
#             hevmCodeSize := extcodesize(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)
#         }
#         return hevmCodeSize > 0;
#     }
# 
#     modifier logs_gas() {
#         uint startGas = gasleft();
#         _;
#         uint endGas = gasleft();
#         emit log_named_uint("gas", startGas - endGas);
#     }
# 
#     function assertTrue(bool condition) internal {
#         if (!condition) {
#             emit log("Error: Assertion Failed");
#             fail();
#         }
#     }
func assertTrue{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(condition : felt):
    if condition == 0:
      log.emit('Error: Assertion Failed')
      # TODO
      # fail()
      tempvar syscall_ptr = syscall_ptr
      tempvar range_check_ptr = range_check_ptr
    else:
      tempvar syscall_ptr = syscall_ptr
      tempvar range_check_ptr = range_check_ptr
    end
    return ()
end


#     function assertTrue(bool condition, string memory err) internal {
#         if (!condition) {
#             emit log_named_string("Error", err);
#             assertTrue(condition);
#         }
#     }
func assertTrueErr{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(condition : felt, err : felt):
  if condition == 0:
    log_named_string.emit('Error', err)
    assertTrue(condition)
  end
  return ()
end


#     function assertEq(address a, address b) internal {
#         if (a != b) {
#             emit log("Error: a == b not satisfied [address]");
#             emit log_named_address("  Expected", b);
#             emit log_named_address("    Actual", a);
#             fail();
#         }
#     }
#     function assertEq(address a, address b, string memory err) internal {
#         if (a != b) {
#             emit log_named_string ("Error", err);
#             assertEq(a, b);
#         }
#     }
func assertEq{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(a : felt, b : felt):
  let (res) = is_not_zero(a-b)
  if res == 1:
    # TODO
    # log.emit('Error: a == b not satisfied [address]')
    log_named_felt.emit(' Expected', b)
    log_named_felt.emit('   Actual', a)

    tempvar syscall_ptr = syscall_ptr
    tempvar range_check_ptr = range_check_ptr
  else:
    tempvar syscall_ptr = syscall_ptr
    tempvar range_check_ptr = range_check_ptr
  end
  return ()
end

func assertEqUint256{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(a : Uint256, b : Uint256):
  let (diff) = uint256_sub(a, b)
  let (res_low) = is_not_zero(diff.low)
  let (res_high) = is_not_zero(diff.high)
  let (res) = is_le(1, res_low + res_high)
  if res == 1:
    # TODO
    # log.emit('Error: a == b not satisfied [address]')
    log_named_uint256.emit(' Expected', b)
    log_named_uint256.emit('   Actual', a)

    tempvar syscall_ptr = syscall_ptr
    tempvar range_check_ptr = range_check_ptr
  else:
    tempvar syscall_ptr = syscall_ptr
    tempvar range_check_ptr = range_check_ptr
  end
  return ()
end

func assertEqErr{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(a : felt, b : felt, err : felt):
  let (res) = is_not_zero(a-b)
  if res == 1:
    log_named_string.emit('Error', err)
    assertEq(a, b)
  end
  return ()
end


#     function assertEq(bytes32 a, bytes32 b) internal {
#         if (a != b) {
#             emit log("Error: a == b not satisfied [bytes32]");
#             emit log_named_bytes32("  Expected", b);
#             emit log_named_bytes32("    Actual", a);
#             fail();
#         }
#     }
#     function assertEq(bytes32 a, bytes32 b, string memory err) internal {
#         if (a != b) {
#             emit log_named_string ("Error", err);
#             assertEq(a, b);
#         }
#     }
#     function assertEq32(bytes32 a, bytes32 b) internal {
#         assertEq(a, b);
#     }
#     function assertEq32(bytes32 a, bytes32 b, string memory err) internal {
#         assertEq(a, b, err);
#     }
#     function assertEq(int a, int b) internal {
#         if (a != b) {
#             emit log("Error: a == b not satisfied [int]");
#             emit log_named_int("  Expected", b);
#             emit log_named_int("    Actual", a);
#             fail();
#         }
#     }
#     function assertEq(int a, int b, string memory err) internal {
#         if (a != b) {
#             emit log_named_string("Error", err);
#             assertEq(a, b);
#         }
#     }
#     function assertEq(uint a, uint b) internal {
#         if (a != b) {
#             emit log("Error: a == b not satisfied [uint]");
#             emit log_named_uint("  Expected", b);
#             emit log_named_uint("    Actual", a);
#             fail();
#         }
#     }
#     function assertEq(uint a, uint b, string memory err) internal {
#         if (a != b) {
#             emit log_named_string("Error", err);
#             assertEq(a, b);
#         }
#     }
#     function assertEqDecimal(int a, int b, uint decimals) internal {
#         if (a != b) {
#             emit log("Error: a == b not satisfied [decimal int]");
#             emit log_named_decimal_int("  Expected", b, decimals);
#             emit log_named_decimal_int("    Actual", a, decimals);
#             fail();
#         }
#     }
#     function assertEqDecimal(int a, int b, uint decimals, string memory err) internal {
#         if (a != b) {
#             emit log_named_string("Error", err);
#             assertEqDecimal(a, b, decimals);
#         }
#     }
#     function assertEqDecimal(uint a, uint b, uint decimals) internal {
#         if (a != b) {
#             emit log("Error: a == b not satisfied [decimal uint]");
#             emit log_named_decimal_uint("  Expected", b, decimals);
#             emit log_named_decimal_uint("    Actual", a, decimals);
#             fail();
#         }
#     }
#     function assertEqDecimal(uint a, uint b, uint decimals, string memory err) internal {
#         if (a != b) {
#             emit log_named_string("Error", err);
#             assertEqDecimal(a, b, decimals);
#         }
#     }
# 
#     function assertGt(uint a, uint b) internal {
#         if (a <= b) {
#             emit log("Error: a > b not satisfied [uint]");
#             emit log_named_uint("  Value a", a);
#             emit log_named_uint("  Value b", b);
#             fail();
#         }
#     }
#     function assertGt(uint a, uint b, string memory err) internal {
#         if (a <= b) {
#             emit log_named_string("Error", err);
#             assertGt(a, b);
#         }
#     }
#     function assertGt(int a, int b) internal {
#         if (a <= b) {
#             emit log("Error: a > b not satisfied [int]");
#             emit log_named_int("  Value a", a);
#             emit log_named_int("  Value b", b);
#             fail();
#         }
#     }
#     function assertGt(int a, int b, string memory err) internal {
#         if (a <= b) {
#             emit log_named_string("Error", err);
#             assertGt(a, b);
#         }
#     }
#     function assertGtDecimal(int a, int b, uint decimals) internal {
#         if (a <= b) {
#             emit log("Error: a > b not satisfied [decimal int]");
#             emit log_named_decimal_int("  Value a", a, decimals);
#             emit log_named_decimal_int("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertGtDecimal(int a, int b, uint decimals, string memory err) internal {
#         if (a <= b) {
#             emit log_named_string("Error", err);
#             assertGtDecimal(a, b, decimals);
#         }
#     }
#     function assertGtDecimal(uint a, uint b, uint decimals) internal {
#         if (a <= b) {
#             emit log("Error: a > b not satisfied [decimal uint]");
#             emit log_named_decimal_uint("  Value a", a, decimals);
#             emit log_named_decimal_uint("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertGtDecimal(uint a, uint b, uint decimals, string memory err) internal {
#         if (a <= b) {
#             emit log_named_string("Error", err);
#             assertGtDecimal(a, b, decimals);
#         }
#     }
# 
#     function assertGe(uint a, uint b) internal {
#         if (a < b) {
#             emit log("Error: a >= b not satisfied [uint]");
#             emit log_named_uint("  Value a", a);
#             emit log_named_uint("  Value b", b);
#             fail();
#         }
#     }
#     function assertGe(uint a, uint b, string memory err) internal {
#         if (a < b) {
#             emit log_named_string("Error", err);
#             assertGe(a, b);
#         }
#     }
#     function assertGe(int a, int b) internal {
#         if (a < b) {
#             emit log("Error: a >= b not satisfied [int]");
#             emit log_named_int("  Value a", a);
#             emit log_named_int("  Value b", b);
#             fail();
#         }
#     }
#     function assertGe(int a, int b, string memory err) internal {
#         if (a < b) {
#             emit log_named_string("Error", err);
#             assertGe(a, b);
#         }
#     }
#     function assertGeDecimal(int a, int b, uint decimals) internal {
#         if (a < b) {
#             emit log("Error: a >= b not satisfied [decimal int]");
#             emit log_named_decimal_int("  Value a", a, decimals);
#             emit log_named_decimal_int("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertGeDecimal(int a, int b, uint decimals, string memory err) internal {
#         if (a < b) {
#             emit log_named_string("Error", err);
#             assertGeDecimal(a, b, decimals);
#         }
#     }
#     function assertGeDecimal(uint a, uint b, uint decimals) internal {
#         if (a < b) {
#             emit log("Error: a >= b not satisfied [decimal uint]");
#             emit log_named_decimal_uint("  Value a", a, decimals);
#             emit log_named_decimal_uint("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertGeDecimal(uint a, uint b, uint decimals, string memory err) internal {
#         if (a < b) {
#             emit log_named_string("Error", err);
#             assertGeDecimal(a, b, decimals);
#         }
#     }
# 
#     function assertLt(uint a, uint b) internal {
#         if (a >= b) {
#             emit log("Error: a < b not satisfied [uint]");
#             emit log_named_uint("  Value a", a);
#             emit log_named_uint("  Value b", b);
#             fail();
#         }
#     }
#     function assertLt(uint a, uint b, string memory err) internal {
#         if (a >= b) {
#             emit log_named_string("Error", err);
#             assertLt(a, b);
#         }
#     }
#     function assertLt(int a, int b) internal {
#         if (a >= b) {
#             emit log("Error: a < b not satisfied [int]");
#             emit log_named_int("  Value a", a);
#             emit log_named_int("  Value b", b);
#             fail();
#         }
#     }
#     function assertLt(int a, int b, string memory err) internal {
#         if (a >= b) {
#             emit log_named_string("Error", err);
#             assertLt(a, b);
#         }
#     }
#     function assertLtDecimal(int a, int b, uint decimals) internal {
#         if (a >= b) {
#             emit log("Error: a < b not satisfied [decimal int]");
#             emit log_named_decimal_int("  Value a", a, decimals);
#             emit log_named_decimal_int("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertLtDecimal(int a, int b, uint decimals, string memory err) internal {
#         if (a >= b) {
#             emit log_named_string("Error", err);
#             assertLtDecimal(a, b, decimals);
#         }
#     }
#     function assertLtDecimal(uint a, uint b, uint decimals) internal {
#         if (a >= b) {
#             emit log("Error: a < b not satisfied [decimal uint]");
#             emit log_named_decimal_uint("  Value a", a, decimals);
#             emit log_named_decimal_uint("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertLtDecimal(uint a, uint b, uint decimals, string memory err) internal {
#         if (a >= b) {
#             emit log_named_string("Error", err);
#             assertLtDecimal(a, b, decimals);
#         }
#     }
# 
#     function assertLe(uint a, uint b) internal {
#         if (a > b) {
#             emit log("Error: a <= b not satisfied [uint]");
#             emit log_named_uint("  Value a", a);
#             emit log_named_uint("  Value b", b);
#             fail();
#         }
#     }
#     function assertLe(uint a, uint b, string memory err) internal {
#         if (a > b) {
#             emit log_named_string("Error", err);
#             assertLe(a, b);
#         }
#     }
#     function assertLe(int a, int b) internal {
#         if (a > b) {
#             emit log("Error: a <= b not satisfied [int]");
#             emit log_named_int("  Value a", a);
#             emit log_named_int("  Value b", b);
#             fail();
#         }
#     }
#     function assertLe(int a, int b, string memory err) internal {
#         if (a > b) {
#             emit log_named_string("Error", err);
#             assertLe(a, b);
#         }
#     }
#     function assertLeDecimal(int a, int b, uint decimals) internal {
#         if (a > b) {
#             emit log("Error: a <= b not satisfied [decimal int]");
#             emit log_named_decimal_int("  Value a", a, decimals);
#             emit log_named_decimal_int("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertLeDecimal(int a, int b, uint decimals, string memory err) internal {
#         if (a > b) {
#             emit log_named_string("Error", err);
#             assertLeDecimal(a, b, decimals);
#         }
#     }
#     function assertLeDecimal(uint a, uint b, uint decimals) internal {
#         if (a > b) {
#             emit log("Error: a <= b not satisfied [decimal uint]");
#             emit log_named_decimal_uint("  Value a", a, decimals);
#             emit log_named_decimal_uint("  Value b", b, decimals);
#             fail();
#         }
#     }
#     function assertLeDecimal(uint a, uint b, uint decimals, string memory err) internal {
#         if (a > b) {
#             emit log_named_string("Error", err);
#             assertGeDecimal(a, b, decimals);
#         }
#     }
# 
#     function assertEq(string memory a, string memory b) internal {
#         if (keccak256(abi.encodePacked(a)) != keccak256(abi.encodePacked(b))) {
#             emit log("Error: a == b not satisfied [string]");
#             emit log_named_string("  Expected", b);
#             emit log_named_string("    Actual", a);
#             fail();
#         }
#     }
#     function assertEq(string memory a, string memory b, string memory err) internal {
#         if (keccak256(abi.encodePacked(a)) != keccak256(abi.encodePacked(b))) {
#             emit log_named_string("Error", err);
#             assertEq(a, b);
#         }
#     }
# 
#     function checkEq0(bytes memory a, bytes memory b) internal pure returns (bool ok) {
#         ok = true;
#         if (a.length == b.length) {
#             for (uint i = 0; i < a.length; i++) {
#                 if (a[i] != b[i]) {
#                     ok = false;
#                 }
#             }
#         } else {
#             ok = false;
#         }
#     }
#     function assertEq0(bytes memory a, bytes memory b) internal {
#         if (!checkEq0(a, b)) {
#             emit log("Error: a == b not satisfied [bytes]");
#             emit log_named_bytes("  Expected", b);
#             emit log_named_bytes("    Actual", a);
#             fail();
#         }
#     }
#     function assertEq0(bytes memory a, bytes memory b, string memory err) internal {
#         if (!checkEq0(a, b)) {
#             emit log_named_string("Error", err);
#             assertEq0(a, b);
#         }
#     }
# }
