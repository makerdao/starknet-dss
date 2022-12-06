// amarna: disable=arithmetic-sub,must-check-caller-address,must-check-overflow
//
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
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

// https://github.com/makerdao/xdomain-dss/blob/add-end/src/Cure.sol
// #commit#4c8db5f96d8a2f8b1ce771941201da4c037fca02

%lang starknet
// pragma solidity ^0.8.13;
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.math import assert_not_equal, assert_not_zero, assert_lt
from starkware.cairo.common.math_cmp import is_not_zero, is_le_felt
from starkware.starknet.common.syscalls import (
    get_caller_address,
    get_contract_address,
    get_block_timestamp,
)
from starkware.cairo.common.uint256 import (
    Uint256,
    uint256_add,
    uint256_sub,
    uint256_eq,
    uint256_le,
    uint256_check,
)
from starkware.cairo.common.alloc import alloc
from contracts.starknet.assertions import assert_both, is_lt, either, is_eq, is_zero
from contracts.starknet.safe_math import add, sub

// interface SourceLike {
//     function cure() external view returns (uint256);
// }
@contract_interface
namespace SourceLike {
    func cure() -> (res: Uint256) {
    }
}

// contract Cure {
//     mapping (address => uint256) public wards;
@storage_var
func _wards(user: felt) -> (res: felt) {
}

// uint256 public live;
@storage_var
func _live() -> (live: felt) {
}

// address[] public srcs;
@storage_var
func _srcs(i: felt) -> (src: felt) {
}

@storage_var
func _srcs_length() -> (src_length: felt) {
}
// uint256 public wait;
@storage_var
func _wait() -> (wait: felt) {
}
// uint256 public when;
@storage_var
func _when() -> (when: felt) {
}
// mapping (address => uint256) public pos; // position in srcs + 1, 0 means a source does not exist
@storage_var
func _pos(src: felt) -> (pos: felt) {
}
// mapping (address => uint256) public amt;
@storage_var
func _amt(src: felt) -> (amt: Uint256) {
}
// mapping (address => uint256) public loaded;
@storage_var
func _loaded(src: felt) -> (loaded: felt) {
}
// uint256 public lCount;
@storage_var
func _lCount() -> (lCount: felt) {
}
// uint256 public say;
@storage_var
func _say() -> (say: Uint256) {
}

// // --- Events ---
//     event Rely(address indexed usr);
//     event Deny(address indexed usr);
@event
func Rely(usr: felt) {
}

@event
func Deny(usr: felt) {
}

// event File(bytes32 indexed what, uint256 data);
@event
func File(what: felt, data: felt) {
}

// event Lift(address indexed src);
@event
func Lift(src: felt) {
}
// event Drop(address indexed src);
@event
func Drop(src: felt) {
}
// event Load(address indexed src);
@event
func Load(src: felt) {
}
// event Cage();
@event
func Cage() {
}

// modifier auth {
//         require(wards[msg.sender] == 1, "Cure/not-authorized");
//         _;
//     }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (ward) = _wards.read(caller);
    with_attr error_message("Cure/not-authorized") {
        assert ward = 1;
    }
    return ();
}

// constructor() {
//         live = 1;
//         wards[msg.sender] = 1;
//         emit Rely(msg.sender);
//     }
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(ward: felt) {
    // wards[msg.sender] = 1;
    _wards.write(ward, 1);

    // live = 1;
    _live.write(1);

    // emit Rely(msg.sender);
    Rely.emit(ward);

    return ();
}

@view
func wards{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(user: felt) -> (
    res: felt
) {
    let (res) = _wards.read(user);
    return (res,);
}

// function tCount() external view returns (uint256 count_) {
//         count_ = srcs.length;
//     }
@view
func tCount{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (count_) = _srcs_length.read();
    return (count_,);
}

@view
func lCount{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (count_) = _lCount.read();
    return (count_,);
}

@view
func srcs{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(index: felt) -> (
    res: felt
) {
    let (src) = _srcs.read(index);
    return (src,);
}

@view
func pos{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(src: felt) -> (
    res: felt
) {
    let (pos) = _pos.read(src);
    return (pos,);
}

@view
func live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (live) = _live.read();
    return (live,);
}

@view
func say{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: Uint256) {
    let (say) = _say.read();
    return (say,);
}

@view
func wait{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (wait) = _wait.read();
    return (wait,);
}

// function list() external view returns (address[] memory) {
@view
func list{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (
    arr_len: felt, arr: felt*
) {
    alloc_locals;
    let (arr_len: felt) = _srcs_length.read();
    let (arr: felt*) = alloc();

    get_list_rec(arr_len, arr, 0);

    return (arr_len, arr);
}

func get_list_rec{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    array_len: felt, array: felt*, index: felt
) {
    if (index == array_len) {
        return ();
    }
    let (src) = _srcs.read(index);
    assert array[index] = src;

    return get_list_rec(array_len, array, index + 1);
}
// return srcs;
//     }

// function tell() external view returns (uint256) {
//         require(live == 0 && (lCount == srcs.length || block.timestamp >= when), "Cure/missing-load-and-time-not-passed");
//         return say;
//     }
@view
func tell{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: Uint256) {
    alloc_locals;
    with_attr error_message("Cure/missing-load-and-time-not-passed") {
        let (live) = _live.read();
        let (length) = _srcs_length.read();
        let (lCount) = _lCount.read();
        let (timestamp) = get_block_timestamp();
        let (when) = _when.read();

        let (not_live) = is_zero(live);
        let (same_length) = is_eq(lCount, length);
        let time_passed = is_le_felt(when, timestamp);
        let (valid) = either(same_length, time_passed);

        assert_both(not_live, valid);
    }

    let (say) = _say.read();
    return (say,);
}

func require_live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    // require(live == 1, "Cure/not-live");
    with_attr error_message("Cure/not-live") {
        let (live) = _live.read();
        assert live = 1;
    }

    return ();
}

// function rely(address usr) external auth {
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // require(live == 1, "Cure/not-live");
    require_live();

    // wards[usr] = 1;
    _wards.write(usr, 1);

    // emit Rely(usr);
    Rely.emit(usr);

    return ();
}

// function deny(address usr) external auth {
@external
func deny{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // require(live == 1, "Cure/not-live");
    // TODO: consider: https://github.com/makerdao/xdomain-dss/issues/4
    require_live();

    // wards[usr] = 0;
    _wards.write(usr, 0);

    // emit Deny(usr);
    Deny.emit(usr);

    return ();
}

// function file(bytes32 what, uint256 data) external auth {
//         require(live == 1, "Cure/not-live");
//         if (what == "wait") wait = data;
//         else revert("Cure/file-unrecognized-param");
//         emit File(what, data);
//     }
@external
func file{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(what: felt, data: felt) {
    auth();

    require_live();

    with_attr error_message("Cure/file-unrecognized-param") {
        assert what = 'wait';
    }
    _wait.write(data);

    File.emit(what, data);

    return ();
}

// function lift(address src) external auth {
//         require(live == 1, "Cure/not-live");
//         require(pos[src] == 0, "Cure/already-existing-source");
//         srcs.push(src);
//         pos[src] = srcs.length;
//         emit Lift(src);
//     }
@external
func lift{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(src: felt) {
    auth();

    require_live();

    with_attr error_message("Cure/already-existing-source") {
        let (pos) = _pos.read(src);
        assert pos = 0;
    }

    let (index) = _srcs_length.read();
    _srcs.write(index, src);
    _srcs_length.write(index + 1);

    _pos.write(src, index + 1);

    Lift.emit(src);

    return ();
}

// function drop(address src) external auth {
//         require(live == 1, "Cure/not-live");
//         uint256 pos_ = pos[src];
//         require(pos_ > 0, "Cure/non-existing-source");
//         uint256 last = srcs.length;
//         if (pos_ < last) {
//             address move = srcs[last - 1];
//             srcs[pos_ - 1] = move;
//             pos[move] = pos_;
//         }
//         srcs.pop();
//         delete pos[src];
//         delete amt[src];
//         emit Drop(src);
//     }
@external
func drop{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(src: felt) {
    alloc_locals;
    auth();

    require_live();

    let (pos_) = _pos.read(src);
    with_attr error_message("Cure/non-existing-source") {
        assert_lt(0, pos_);
    }
    let (last) = _srcs_length.read();
    let (valid_pos) = is_lt(pos_, last);
    if (valid_pos == 1) {
        let (move) = _srcs.read(last - 1);
        _srcs.write(pos_ - 1, move);
        _pos.write(move, pos_);
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
    } else {
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
    }

    _srcs_length.write(last - 1);
    _srcs.write(last, 0);
    _pos.write(src, 0);
    _amt.write(src, Uint256(0, 0));
    Drop.emit(src);

    return ();
}

// function cage() external auth {
//         require(live == 1, "Cure/not-live");
//         live = 0;
//         when = block.timestamp + wait;
//         emit Cage();
//     }
@external
func cage{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    auth();

    require_live();

    _live.write(0);

    let (timestamp) = get_block_timestamp();
    let (wait) = _wait.read();
    _when.write(timestamp + wait);
    Cage.emit();

    return ();
}

// function load(address src) external {
@external
func load{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(src: felt) {
    alloc_locals;
    // require(live == 0, "Cure/still-live");
    with_attr error_message("Cure/still-live") {
        let (live) = _live.read();
        assert live = 0;
    }

    // require(pos[src] > 0, "Cure/non-existing-source");
    let (pos_) = _pos.read(src);
    with_attr error_message("Cure/non-existing-source") {
        assert_lt(0, pos_);
    }

    // uint256 oldAmt_ = amt[src];
    // uint256 newAmt_ = amt[src] = SourceLike(src).cure();
    let (oldAmt_) = _amt.read(src);
    let (newAmt_) = SourceLike.cure(src);
    _amt.write(src, newAmt_);
    // say = say - oldAmt_ + newAmt_;
    let (say: Uint256) = _say.read();
    let (local sub_) = sub(say, oldAmt_);
    let (sum) = add(sub_, newAmt_);
    _say.write(sum);

    // if (loaded[src] == 0) {
    //             loaded[src] = 1;
    //             lCount++;
    //         }
    let (loaded) = _loaded.read(src);
    if (loaded == 0) {
        _loaded.write(src, 1);
        let (lCount) = _lCount.read();
        _lCount.write(lCount + 1);
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
    } else {
        tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
        tempvar syscall_ptr: felt* = syscall_ptr;
        tempvar range_check_ptr = range_check_ptr;
    }

    // emit Load(src);
    Load.emit(src);

    return ();
}
