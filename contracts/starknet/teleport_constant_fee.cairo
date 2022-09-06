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

// pragma solidity 0.8.14;
%lang starknet

// import {TeleportGUID} from "./TeleportGUID.sol";
from contracts.starknet.teleport_GUID import TeleportGUID
from contracts.starknet.safe_math import Int256, add, mul, div
from contracts.starknet.assertions import eq_0
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.math_cmp import is_le_felt
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.starknet.common.syscalls import get_block_timestamp

// interface TeleportFees {
//     /**
//     * @dev Return fee for particular teleport. It should return 0 for teleports that are being slow withdrawn.
//     * note: We define slow withdrawal as teleport older than x. x has to be enough to finalize flush (not teleport itself).
//     * @param teleportGUID Struct which contains the whole teleport data
//     * @param line Debt ceiling
//     * @param debt Current debt
//     * @param pending Amount left to withdraw
//     * @param amtToTake Amount to take. Can be less or equal to teleportGUID.amount b/c of debt ceiling or because it is pending
//     * @return fees Fee amount [WAD]
//     **/
//     function getFee(
//         TeleportGUID calldata teleportGUID, uint256 line, int256 debt, uint256 pending, uint256 amtToTake
//     ) external view returns (uint256 fees);
// }
// @contract_interface
// namespace TeleportFees:
//     func getFee(
//         teleportGUID : TeleportGUID,
//         line : Uint256,
//         debt : Int256,
//         pending : Uint256,
//         amtToTake : Uint256,
//     ) -> (fees : Uint256):
//     end
// end

// contract TeleportConstantFee is TeleportFees {
//     uint256 immutable public fee;
@storage_var
func _fee() -> (fee: Uint256) {
}
// uint256 immutable public ttl;
@storage_var
func _ttl() -> (ttl: felt) {
}

// /**
//     * @param _fee Constant fee in WAD
//     * @param _ttl Time in seconds to finalize flush (not teleport)
//     **/
//     constructor(uint256 _fee, uint256 _ttl) {
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    fee_: Uint256, ttl_: felt
) {
    // fee = _fee;
    _fee.write(fee_);
    // ttl = _ttl;
    _ttl.write(ttl_);
    return ();
}

@view
func fee{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (fee: Uint256) {
    let (fee) = _fee.read();
    return (fee,);
}

@view
func ttl{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (ttl: felt) {
    let (ttl) = _ttl.read();
    return (ttl,);
}

// function getFee(TeleportGUID calldata guid, uint256, int256, uint256, uint256 amtToTake) override external view returns (uint256) {
@view
func getFee{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    guid: TeleportGUID, line: Uint256, debt: Int256, pending: Uint256, amtToTake: Uint256
) -> (fees: Uint256) {
    alloc_locals;
    // // is slow withdrawal?
    // if (block.timestamp >= uint256(guid.timestamp) + ttl) {
    let (timestamp) = get_block_timestamp();
    let (ttl) = _ttl.read();
    let time_passed = is_le_felt(guid.timestamp + ttl, timestamp);
    if (time_passed == 1) {
        return (Uint256(0, 0),);
    }
    // return 0;
    //         }

    // // is empty teleport?
    //         if (guid.amount == 0) {
    let (empty_teleport) = eq_0(guid.amount);
    if (empty_teleport == 1) {
        return (Uint256(0, 0),);
    }
    // return 0;
    //         }

    // return fee * amtToTake / guid.amount;
    let (fee) = _fee.read();
    let (mul_) = mul(fee, amtToTake);
    let (fees) = div(mul_, guid.amount);
    return (fees,);
}
