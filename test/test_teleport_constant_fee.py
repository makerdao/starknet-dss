# pragma solidity 0.8.14;

# import "ds-test/test.sol";

# import "src/TeleportConstantFee.sol";
# import "src/TeleportGUID.sol";

# contract TeleportConstantFeeTest is DSTest {

#     uint256 internal fee = 1 ether / 100;
#     uint256 internal ttl = 8 days;

#     TeleportConstantFee internal teleportConstantFee;

#     function setUp() public {
#         teleportConstantFee = new TeleportConstantFee(fee, ttl);
#     }

#     function testConstructor() public {
#         assertEq(teleportConstantFee.fee(), fee);
#         assertEq(teleportConstantFee.ttl(), ttl);
#     }

#     function testFeeForZeroAmount() public {
#         TeleportGUID memory guid = TeleportGUID({
#             sourceDomain: "l2network",
#             targetDomain: "ethereum",
#             receiver: addressToBytes32(address(123)),
#             operator: addressToBytes32(address(this)),
#             amount: 0,
#             nonce: 5,
#             timestamp: uint48(block.timestamp)
#         });

#         assertEq(teleportConstantFee.getFee(guid, 0, 0, 0, 10 ether), 0);
#     }
# }
