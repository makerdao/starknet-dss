# pragma solidity 0.8.14;

# import {TeleportFees} from "./TeleportFees.sol";
# import {TeleportGUID} from "./TeleportGUID.sol";

# contract TeleportConstantFee is TeleportFees {
#     uint256 immutable public fee;
#     uint256 immutable public ttl;

#     /**
#     * @param _fee Constant fee in WAD
#     * @param _ttl Time in seconds to finalize flush (not teleport)
#     **/
#     constructor(uint256 _fee, uint256 _ttl) {
#         fee = _fee;
#         ttl = _ttl;
#     }

#     function getFee(TeleportGUID calldata guid, uint256, int256, uint256, uint256 amtToTake) override external view returns (uint256) {
#         // is slow withdrawal?
#         if (block.timestamp >= uint256(guid.timestamp) + ttl) {
#             return 0;
#         }

#         // is empty teleport?
#         if (guid.amount == 0) {
#             return 0;
#         }

#         return fee * amtToTake / guid.amount;
#     }
# }
