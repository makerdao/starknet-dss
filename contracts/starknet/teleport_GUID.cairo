// pragma solidity 0.8.14;
%lang starknet

// // Standard Maker Teleport GUID
// struct TeleportGUID {
//     bytes32 sourceDomain;
//     bytes32 targetDomain;
//     bytes32 receiver;
//     bytes32 operator;
//     uint128 amount;
//     uint80 nonce;
//     uint48 timestamp;
// }

from starkware.cairo.common.cairo_builtins import HashBuiltin, SignatureBuiltin
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.hash import hash2

struct TeleportGUID {
    source_domain: felt,
    target_domain: felt,
    receiver: felt,
    operator: felt,
    amount: Uint256,
    nonce: felt,
    timestamp: felt,
}

// // solhint-disable-next-line func-visibility
// function bytes32ToAddress(bytes32 addr) pure returns (address) {
//     return address(uint160(uint256(addr)));
// }

// // solhint-disable-next-line func-visibility
// function addressToBytes32(address addr) pure returns (bytes32) {
//     return bytes32(uint256(uint160(addr)));
// }

// // solhint-disable-next-line func-visibility
// function getGUIDHash(TeleportGUID memory teleportGUID) pure returns (bytes32 guidHash) {
//     guidHash = keccak256(abi.encode(
//         teleportGUID.sourceDomain,
//         teleportGUID.targetDomain,
//         teleportGUID.receiver,
//         teleportGUID.operator,
//         teleportGUID.amount,
//         teleportGUID.nonce,
//         teleportGUID.timestamp
//     ));
// }
func get_GUID_hash{pedersen_ptr: HashBuiltin*}(t: TeleportGUID*) -> (res: felt) {
    // h(source_domain, h(target_domain, h(receiver, h(operator, h(amount, h(nonce, timestamp))))))

    let hash_ptr = pedersen_ptr;
    with hash_ptr {
        let (_hash1) = hash2(t.timestamp, t.nonce);
        let (_hash2) = hash2(_hash1, t.amount.low);
        let (_hash3) = hash2(_hash2, t.amount.high);
        let (_hash4) = hash2(_hash3, t.operator);
        let (_hash5) = hash2(_hash4, t.receiver);
        let (_hash6) = hash2(_hash5, t.target_domain);
        let (hash) = hash2(_hash6, t.source_domain);
    }

    let pedersen_ptr = hash_ptr;
    return (hash,);
}
