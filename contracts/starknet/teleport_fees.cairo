// pragma solidity 0.8.14;

// import "./TeleportGUID.sol";

// // Calculate fees for a given Teleport GUID
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
