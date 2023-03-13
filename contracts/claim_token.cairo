// SPDX-License-Identifier: AGPL-3.0-or-later
%lang starknet

// ClaimToken.sol -- Claim token

// Copyright (C) 2017, 2018, 2019 dbrock, rain, mrchico
// Copyright (C) 2021-2022 Dai Foundation
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// pragma solidity ^0.8.13;
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.math import assert_not_equal, assert_not_zero
from starkware.starknet.common.syscalls import get_caller_address, get_contract_address
from starkware.cairo.common.uint256 import Uint256, uint256_eq
from safe_math import add, sub
from assertions import assert_ge, is_eq

// interface IERC1271 {
//     function isValidSignature(
//         bytes32,
//         bytes memory
//     ) external view returns (bytes4);
// }
// @contract_interface
// namespace IERC721 {
//     func is_valid_signature(sig: felt, a: felt) -> (dai: Uint256) {
//     }
// }

// contract ClaimToken {
//     mapping (address => uint256) public wards;
@storage_var
func _wards(user: felt) -> (res: felt) {
}

// // --- ERC20 Data ---
//     string  public constant name     = "Maker Global Settlement Claim";
//     string  public constant symbol   = "CLAIM";
//     string  public constant version  = "1";
//     uint8   public constant decimals = 45;
//     uint256 public totalSupply;
@storage_var
func _total_supply() -> (res: Uint256) {
}

@view
func totalSupply{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (
    res: Uint256
) {
    let (res) = _total_supply.read();
    return (res,);
}

// mapping (address => uint256)                      public balanceOf;
@storage_var
func _balances(user: felt) -> (res: Uint256) {
}

@view
func balanceOf{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(user: felt) -> (
    res: Uint256
) {
    let (res) = _balances.read(user=user);
    return (res,);
}
// mapping (address => mapping (address => uint256)) public allowance;
@storage_var
func _allowances(owner: felt, spender: felt) -> (res: Uint256) {
}
// mapping (address => uint256)                      public nonces;
@storage_var
func _nonces(user: felt) -> (res: Uint256) {
}

@view
func decimals{}() -> (res: felt) {
    return (45,);
}

@view
func name{}() -> (res: felt) {
    return ('Maker Global Settlement Claim',);
}

@view
func symbol{}() -> (res: felt) {
    return ('CLAIM',);
}

@view
func version{}() -> (res: felt) {
    return ('1',);
}

// // --- Events ---
//     event Rely(address indexed usr);
//     event Deny(address indexed usr);
//     event Approval(address indexed owner, address indexed spender, uint256 value);
//     event Transfer(address indexed from, address indexed to, uint256 value);
@event
func Rely(usr: felt) {
}

@event
func Deny(usr: felt) {
}

@event
func Transfer(sender: felt, recipient: felt, value: Uint256) {
}

@event
func Approval(owner: felt, spender: felt, value: Uint256) {
}

// // --- EIP712 niceties ---
//     uint256 public immutable deploymentChainId;
//     bytes32 private immutable _DOMAIN_SEPARATOR;
//     bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

// modifier auth {
//         require(wards[msg.sender] == 1, "ClaimToken/not-authorized");
//         _;
//     }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();

    let (ward) = _wards.read(caller);
    with_attr error_message("ClaimToken/not-authorized") {
        assert ward = 1;
    }

    return ();
}

// constructor() {
//         wards[msg.sender] = 1;
//         emit Rely(msg.sender);

// deploymentChainId = block.chainid;
//         _DOMAIN_SEPARATOR = _calculateDomainSeparator(block.chainid);
//     }
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ward: felt) {
    _wards.write(ward, 1);
    Rely.emit(ward);
    return ();
}

// function _calculateDomainSeparator(uint256 chainId) private view returns (bytes32) {
//         return keccak256(
//             abi.encode(
//                 keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
//                 keccak256(bytes(name)),
//                 keccak256(bytes(version)),
//                 chainId,
//                 address(this)
//             )
//         );
//     }

// function DOMAIN_SEPARATOR() external view returns (bytes32) {
//         return block.chainid == deploymentChainId ? _DOMAIN_SEPARATOR : _calculateDomainSeparator(block.chainid);
//     }

// // --- Administration ---
//     function rely(address usr) external auth {
//         wards[usr] = 1;
//         emit Rely(usr);
//     }

// function deny(address usr) external auth {
//         wards[usr] = 0;
//         emit Deny(usr);
//     }
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();
    _wards.write(usr, 1);
    Rely.emit(usr);
    return ();
}

@external
func deny{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();
    _wards.write(usr, 0);
    Deny.emit(usr);
    return ();
}

// --- ERC20 Mutations ---
//     function transfer(address to, uint256 value) external returns (bool) {
@external
func transfer{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(to: felt, value: Uint256) -> (res: felt) {
    alloc_locals;
    // require(to != address(0) && to != address(this), "ClaimToken/invalid-address");
    with_attr error_message("ClaimToken/invalid-address") {
        assert_not_zero(to);
        let (this_address) = get_contract_address();
        assert_not_equal(to, this_address);
    }
    // uint256 balance = balanceOf[msg.sender];
    let (caller) = get_caller_address();
    let (balance) = _balances.read(caller);
    // require(balance >= value, "ClaimToken/insufficient-balance");
    with_attr error_message("ClaimToken/insufficient-balance") {
        assert_ge(value, balance);
    }
    // unchecked {
    //     balanceOf[msg.sender] = balance - value;
    //     balanceOf[to] += value;
    // }
    let (new_balance) = sub(balance, value);
    _balances.write(caller, new_balance);
    let (to_balance) = _balances.read(to);
    let (new_to_balance) = add(to_balance, value);
    _balances.write(to, new_to_balance);

    // emit Transfer(msg.sender, to, value);
    Transfer.emit(caller, to, value);

    // return true;
    return (1,);
}

// function transferFrom(address from, address to, uint256 value) external returns (bool) {
@external
func transferFrom{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(sender: felt, recipient: felt, value: Uint256) -> (res: felt) {
    alloc_locals;
    // require(to != address(0) && to != address(this), "ClaimToken/invalid-address");
    with_attr error_message("ClaimToken/invalid-address") {
        assert_not_zero(recipient);
        let (this_address) = get_contract_address();
        assert_not_equal(recipient, this_address);
    }
    // uint256 balance = balanceOf[from];
    let (balance) = _balances.read(sender);
    // require(balance >= value, "ClaimToken/insufficient-balance");
    with_attr error_message("ClaimToken/insufficient-balance") {
        assert_ge(value, balance);
    }
    let (caller) = get_caller_address();
    // if (from != msg.sender) {
    if (sender != caller) {
        // uint256 allowed = allowance[from][msg.sender];
        let (allowed) = _allowances.read(sender, caller);
        let (is_max) = uint256_eq(allowed, Uint256(2 ** 128 - 1, 2 ** 128 - 1));
        // if (allowed != type(uint256).max) {
        if (is_max == 0) {
            // require(allowed >= value, "ClaimToken/insufficient-allowance");
            with_attr error_message("ClaimToken/insufficient-allowance") {
                assert_ge(allowed, value);
            }

            // unchecked {
            //     allowance[from][msg.sender] = allowed - value;
            // }
            let (new_allowed) = sub(allowed, value);
            _allowances.write(sender, caller, new_allowed);
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
            tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
        } else {
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
            tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
        }
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
        tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
    } else {
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
        tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
    }

    tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
    tempvar syscall_ptr: felt* = syscall_ptr;
    tempvar range_check_ptr = range_check_ptr;
    tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;

    // unchecked {
    //     balanceOf[from] = balance - value;
    //     balanceOf[to] += value;
    // }
    let (new_balance) = sub(balance, value);
    _balances.write(sender, new_balance);
    let (to_balance) = _balances.read(recipient);
    let (new_to_balance) = add(to_balance, value);
    _balances.write(recipient, new_to_balance);

    // emit Transfer(from, to, value);
    Transfer.emit(sender, recipient, value);

    // return true;
    return (1,);
}

// function approve(address spender, uint256 value) external returns (bool) {
@external
func approve{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(spender: felt, value: Uint256) -> (res: felt) {
    alloc_locals;
    // allowance[msg.sender][spender] = value;
    let (caller) = get_caller_address();
    _allowances.write(caller, spender, value);

    // emit Approval(msg.sender, spender, value);
    Approval.emit(caller, spender, value);

    // return true;
    return (1,);
}

// function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
@external
func increaseAllowance{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(spender: felt, added_value: Uint256) -> (res: felt) {
    alloc_locals;
    // uint256 newValue = allowance[msg.sender][spender] + addedValue;
    let (caller) = get_caller_address();
    let (allowed) = _allowances.read(caller, spender);
    let (new_value) = add(allowed, added_value);
    // allowance[msg.sender][spender] = newValue;
    _allowances.write(caller, spender, new_value);

    // emit Approval(msg.sender, spender, newValue);
    Approval.emit(caller, spender, new_value);

    // return true;
    return (1,);
}

// function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
@external
func decreaseAllowance{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(spender: felt, subtracted_value: Uint256) -> (res: felt) {
    alloc_locals;
    // uint256 allowed = allowance[msg.sender][spender];
    let (caller) = get_caller_address();
    let (allowed) = _allowances.read(caller, spender);
    // require(allowed >= subtractedValue, "ClaimToken/insufficient-allowance");
    with_attr error_message("ClaimToken/insufficient-allowance") {
        assert_ge(allowed, subtracted_value);
    }
    // unchecked{
    //     allowed = allowed - subtractedValue;
    // }
    let (new_allowed) = sub(allowed, subtracted_value);
    // allowance[msg.sender][spender] = allowed;
    _allowances.write(caller, spender, new_allowed);

    // emit Approval(msg.sender, spender, allowed);
    Approval.emit(caller, spender, new_allowed);

    // return true;
    return (1,);
}

// --- Mint/Burn ---
//     function mint(address to, uint256 value) external auth {
@external
func mint{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(to: felt, value: Uint256) {
    alloc_locals;
    auth();
    // require(to != address(0) && to != address(this), "ClaimToken/invalid-address");
    with_attr error_message("ClaimToken/invalid-address") {
        assert_not_zero(to);
        let (this_address) = get_contract_address();
        assert_not_equal(to, this_address);
    }
    // unchecked {
    //     balanceOf[to] = balanceOf[to] + value; // note: we don't need an overflow check here b/c balanceOf[to] <= totalSupply and there is an overflow check below
    // }
    let (to_balance) = _balances.read(to);
    let (new_to_balance) = add(to_balance, value);
    _balances.write(to, new_to_balance);
    // totalSupply = totalSupply + value;
    let (total_supply) = _total_supply.read();
    let (new_total_supply) = add(total_supply, value);
    _total_supply.write(new_total_supply);

    // emit Transfer(address(0), to, value);
    Transfer.emit(0, to, value);

    return ();
}

// function burn(address from, uint256 value) external {
@external
func burn{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(account: felt, value: Uint256) {
    alloc_locals;
    // uint256 balance = balanceOf[from];
    let (balance) = _balances.read(account);
    // require(balance >= value, "ClaimToken/insufficient-balance");
    with_attr error_message("ClaimToken/insufficient-balance") {
        assert_ge(balance, value);
    }
    let (caller) = get_caller_address();
    // if (from != msg.sender) {
    let (eq) = is_eq(account, caller);
    if (eq == 0) {
        // uint256 allowed = allowance[from][msg.sender];
        let (allowed) = _allowances.read(account, caller);
        // if (allowed != type(uint256).max) {
        let (eq) = uint256_eq(allowed, Uint256(2 ** 128 - 1, 2 ** 128 - 1));
        if (eq == 0) {
            // require(allowed >= value, "ClaimToken/insufficient-allowance");
            with_attr error_message("ClaimToken/insufficient-allowance") {
                assert_ge(allowed, value);
            }
            // unchecked {
            //             allowance[from][msg.sender] = allowed - value;
            //         }
            let (new_allowed) = sub(allowed, value);
            _allowances.write(account, caller, new_allowed);
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
            tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
        } else {
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
            tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
        }
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
        tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
    } else {
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
        tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
    }

    tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
    tempvar syscall_ptr: felt* = syscall_ptr;
    tempvar range_check_ptr = range_check_ptr;
    tempvar bitwise_ptr: BitwiseBuiltin* = bitwise_ptr;
    // unchecked {
    //     balanceOf[from] = balance - value; // note: we don't need overflow checks b/c require(balance >= value) and balance <= totalSupply
    //     totalSupply     = totalSupply - value;
    // }
    let (new_balance) = sub(balance, value);
    _balances.write(account, new_balance);
    let (total_supply) = _total_supply.read();
    let (new_total_supply) = sub(total_supply, value);
    _total_supply.write(new_total_supply);

    // emit Transfer(from, address(0), value);
    Transfer.emit(account, 0, value);

    return ();
}
