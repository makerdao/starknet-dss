// // SPDX-License-Identifier: AGPL-3.0-or-later
// pragma solidity 0.8.15;
%lang starknet
// import "./VatMock.sol";
// import "./DaiMock.sol";
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256, uint256_check
from contracts.starknet.safe_math import mul
from starkware.starknet.common.syscalls import get_contract_address, get_caller_address

@contract_interface
namespace VatLike {
    func move(src: felt, dst: felt, rad: Uint256) {
    }
}

@contract_interface
namespace DaiLike {
    func burn(src: felt, value: Uint256) {
    }

    func mint(dst: felt, value: Uint256) {
    }
}

// contract DaiJoinMock {
//     VatMock public vat;
//     DaiMock public dai;
@storage_var
func _vat() -> (felt,) {
}

@storage_var
func _dai() -> (felt,) {
}

@view
func dai{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _dai.read();
    return (res,);
}

@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    vat_: felt, dai_: felt
) {
    _vat.write(vat_);
    _dai.write(dai_);
    return ();
}
// uint256 internal constant RAY = 10 ** 27;
const RAY = 10 ** 27;

// function mul(uint256 x, uint256 y) internal pure returns (uint256 z) {
//         unchecked{
//             require(y == 0 || (z = x * y) / y == x);
//         }
//     }
//     function join(address usr, uint256 wad) external {
//         vat.move(address(this), usr, mul(RAY, wad));
//         dai.burn(msg.sender, wad);
//     }
@external
func join{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    usr: felt, wad: Uint256
) {
    let (amount) = mul(Uint256(RAY, 0), wad);
    let (self) = get_contract_address();
    let (caller) = get_caller_address();
    let (vat) = _vat.read();
    let (dai) = _dai.read();
    VatLike.move(vat, self, usr, amount);
    DaiLike.burn(dai, caller, wad);
    return ();
}
// function exit(address usr, uint256 wad) external {
//         vat.move(msg.sender, address(this), mul(RAY, wad));
//         dai.mint(usr, wad);
//     }
// }
@external
func exit{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    usr: felt, wad: Uint256
) {
    let (amount) = mul(Uint256(RAY, 0), wad);
    let (vat) = _vat.read();
    let (dai) = _dai.read();
    let (self) = get_contract_address();
    let (caller) = get_caller_address();
    VatLike.move(vat, caller, self, amount);
    DaiLike.mint(dai, usr, wad);
    return ();
}
