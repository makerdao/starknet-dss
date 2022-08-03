# pragma solidity 0.8.14;

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

struct TeleportGUID:
  member source_domain: felt
  member target_domain: felt
  member receiver: felt
  member operator: felt
  member amount: felt
  member nonce: felt
  member timestamp: felt
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
