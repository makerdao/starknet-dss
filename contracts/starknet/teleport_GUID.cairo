# pragma solidity 0.8.14;
%lang starknet

# // Standard Maker Teleport GUID
# struct TeleportGUID {
#     bytes32 sourceDomain;
#     bytes32 targetDomain;
#     bytes32 receiver;
#     bytes32 operator;
#     uint128 amount;
#     uint80 nonce;
#     uint48 timestamp;
# }

from starkware.cairo.common.cairo_builtins import HashBuiltin, SignatureBuiltin
from starkware.cairo.common.uint256 import Uint256

struct TeleportGUID:
    member source_domain : felt
    member target_domain : felt
    member receiver : felt
    member operator : felt
    member amount : Uint256
    member nonce : felt
    member timestamp : felt
end

# // solhint-disable-next-line func-visibility
# function bytes32ToAddress(bytes32 addr) pure returns (address) {
#     return address(uint160(uint256(addr)));
# }

# // solhint-disable-next-line func-visibility
# function addressToBytes32(address addr) pure returns (bytes32) {
#     return bytes32(uint256(uint160(addr)));
# }

# // solhint-disable-next-line func-visibility
# function getGUIDHash(TeleportGUID memory teleportGUID) pure returns (bytes32 guidHash) {
#     guidHash = keccak256(abi.encode(
#         teleportGUID.sourceDomain,
#         teleportGUID.targetDomain,
#         teleportGUID.receiver,
#         teleportGUID.operator,
#         teleportGUID.amount,
#         teleportGUID.nonce,
#         teleportGUID.timestamp
#     ));
# }
func getGUIDHash{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    teleportGUID : TeleportGUID
) -> (guidHash : felt):
    return (guidHash=0)
end
