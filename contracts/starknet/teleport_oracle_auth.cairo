%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, SignatureBuiltin
from starkware.starknet.common.syscalls import get_caller_address
from starkware.cairo.common.math import assert_lt
from starkware.cairo.common.Uint256 import Uint256
from starkware.cairo.common.signature import verify_ecdsa_signature
from contracts.starknet.assertions import is_eq
from contracts.starknet.teleport_GUID import TeleportGUID

# import "./TeleportGUID.sol";

# interface TeleportJoinLike {
#     function requestMint(
#         TeleportGUID calldata teleportGUID,
#         uint256 maxFeePercentage,
#         uint256 operatorFee
#     ) external returns (uint256 postFeeAmount, uint256 totalFee);
# }

struct Signature:
    member pk : felt
    member r : felt
    member s : felt
end

# // TeleportOracleAuth provides user authentication for TeleportJoin, by means of Maker Oracle Attestations
# contract TeleportOracleAuth {

# mapping (address => uint256) public wards;   // Auth
@storage_var
func _wards(user : felt) -> (res : felt):
end

# mapping (address => uint256) public signers; // Oracle feeds
@storage_var
func _signers(address : felt) -> (res : felt):
end

# TeleportJoinLike immutable public teleportJoin;
@storage_var
func _teleport_join() -> (join : felt):
end

# uint256 public threshold;
@storage_var
func _threshold() -> (threshold : felt):
end

# event Rely(address indexed usr);
@event
func Rely(user : felt):
end

# event Deny(address indexed usr);
@event
func Deny(user : felt):
end

# event File(bytes32 indexed what, uint256 data);
#     event SignersAdded(address[] signers);
#     event SignersRemoved(address[] signers);

# modifier auth {
#         require(wards[msg.sender] == 1, "TeleportOracleAuth/not-authorized");
#         _;
#     }
func auth{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}():
    let (caller) = get_caller_address()
    let (ward) = _wards.read(caller)
    with_attr error_message("teleport_oracle_auth/not-authorized"):
        assert ward = 1
    end
    return ()
end

# TODO: do we still need to send ward as constructor param?
#     constructor(address teleportJoin_) {
@constructor
func constructor{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    ward : felt, teleport_join_ : felt
):
    # wards[msg.sender] = 1;
    _wards.write(ward, 1)

    # emit Rely(msg.sender);
    Rely.emit(ward)

    _teleport_join.write(teleport_join_)
    # teleportJoin = TeleportJoinLike(teleportJoin_);

    return ()
end

# function rely(address usr) external auth {
@external
func rely{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(usr : felt):
    auth()

    # wards[usr] = 1;
    _wards.write(usr, 1)

    # emit Rely(usr);
    Rely.emit(usr)

    return ()
end

# function deny(address usr) external auth {
@external
func deny{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(user : felt):
    auth()

    # wards[usr] = 0;
    _wards.write(user, 0)

    # emit Deny(usr);
    Deny.emit(user)

    return ()
end

# function file(bytes32 what, uint256 data) external auth {
#         if (what == "threshold") {
#             threshold = data;
#         } else {
#             revert("TeleportOracleAuth/file-unrecognized-param");
#         }
#         emit File(what, data);
#     }

# function addSigners(address[] calldata signers_) external auth {
#         for(uint i; i < signers_.length; i++) {
#             signers[signers_[i]] = 1;
#         }
#         emit SignersAdded(signers_);
#     }

# function removeSigners(address[] calldata signers_) external auth {
#         for(uint i; i < signers_.length; i++) {
#             signers[signers_[i]] = 0;
#         }
#         emit SignersRemoved(signers_);
#     }

# /**
#      * @notice Verify oracle signatures and call TeleportJoin to mint DAI if the signatures are valid
#      * (only callable by teleport's operator or receiver)
#      * @param teleportGUID The teleport GUID to register
#      * @param signatures The byte array of concatenated signatures ordered by increasing signer addresses.
#      * Each signature is {bytes32 r}{bytes32 s}{uint8 v}
#      * @param maxFeePercentage Max percentage of the withdrawn amount (in WAD) to be paid as fee (e.g 1% = 0.01 * WAD)
#      * @param operatorFee The amount of DAI to pay to the operator
#      * @return postFeeAmount The amount of DAI sent to the receiver after taking out fees
#      * @return totalFee The total amount of DAI charged as fees
#      */
#     function requestMint(
#         TeleportGUID calldata teleportGUID,
#         bytes calldata signatures,
#         uint256 maxFeePercentage,
#         uint256 operatorFee
func request_mint{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, ecdsa_ptr : SignatureBuiltin*
}(
    teleport_GUID : TeleportGUID,
    sigs : Signature*,
    sigs_len : felt,
    max_fee_percentage : Uint256,
    operator_fee : Uint256,
) -> (post_fee_amount : Uint256, operator_fee : Uint256):
    # require(bytes32ToAddress(teleportGUID.receiver) == msg.sender ||
    #   bytes32ToAddress(teleportGUID.operator) == msg.sender, "TeleportOracleAuth/not-receiver-nor-operator");
    let (caller) = get_caller_address()
    let is_receiver = is_eq(caller, teleport_GUID.receiver)
    if is_receiver == 0:
        with_attr error_message("teleport_oracle_auth/not-receiver-nor-operator"):
            assert caller = teleport_GUID.operator
        end
    end

    # require(isValid(getSignHash(teleportGUID), signatures, threshold), "TeleportOracleAuth/not-enough-valid-sig");
    let (threshold_) = _threshold.read()
    let teleport_hash = ()  # TODO!
    validate(teleport_hash, sigs, sigs_len, threshold_)

    # (postFeeAmount, totalFee) = teleportJoin.requestMint(teleportGUID, maxFeePercentage, operatorFee);
    let teleport_join_ = _teleport_join.read()
    let (post_fee_amount, operator_fee) = TeleportJoinLike.request_mint(
        teleport_join_, teleport_guid, max_fee_percentage, operator_fee
    )

    return (post_fee_amount, operator_fee)
end

# /**
#      * @notice Returns true if `signatures` contains at least `threshold_` valid signatures of a given `signHash`
#      * @param signHash The signed message hash
#      * @param signatures The byte array of concatenated signatures ordered by increasing signer addresses.
#      * Each signature is {bytes32 r}{bytes32 s}{uint8 v}
#      * @param threshold_ The minimum number of valid signatures required for the method to return true
#      * @return valid Signature verification result
#      */
#     function isValid(bytes32 signHash, bytes calldata signatures, uint threshold_) public view returns (bool valid) {
#         uint256 count = signatures.length / 65;
#         require(count >= threshold_, "TeleportOracleAuth/not-enough-sig");

# uint8 v;
#         bytes32 r;
#         bytes32 s;
#         uint256 numValid;
#         address lastSigner;
#         for (uint256 i; i < count;) {
#             (v,r,s) = splitSignature(signatures, i);
#             address recovered = ecrecover(signHash, v, r, s);
#             require(recovered > lastSigner, "TeleportOracleAuth/bad-sig-order"); // make sure signers are different
#             lastSigner = recovered;
#             if (signers[recovered] == 1) {
#                 unchecked { numValid += 1; }
#                 if (numValid >= threshold_) {
#                     return true;
#                 }
#             }
#             unchecked { i++; }
#         }
#     }
func validate{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, ecdsa_ptr : SignatureBuiltin*
}(message : felt, sigs : Signature*, sigs_len : felt, threshold_ : felt):
    if threshold_ == 0:
        return ()
    end

    assert_lt(0, sigs_len)

    let sig : Signature = sigs[0]

    let (valid_sig) = _signers.read(sig.pk)

    assert valid_sig = 1

    verify_ecdsa_signature(message, sig.pk, sig.r, sig.s)

    validate(message, sigs + 1, sigs_len - 1, threshold_ - 1)

    return ()
end

# /**
#      * @notice This has to match what oracles are signing
#      * @param teleportGUID The teleport GUID to calculate hash
#      */
#     function getSignHash(TeleportGUID memory teleportGUID) public pure returns (bytes32 signHash) {
#         signHash = keccak256(abi.encodePacked(
#             "\x19Ethereum Signed Message:\n32",
#             getGUIDHash(teleportGUID)
#         ));
#     }

# /**
#      * @notice Parses the signatures and extract (r, s, v) for a signature at a given index.
#      * @param signatures concatenated signatures. Each signature is {bytes32 r}{bytes32 s}{uint8 v}
#      * @param index which signature to read (0, 1, 2, ...)
#      */
#     function splitSignature(bytes calldata signatures, uint256 index) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
#         // we jump signatures.offset to get the first slot of signatures content
#         // we jump 65 (0x41) per signature
#         // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
#         uint256 start;
#         // solhint-disable-next-line no-inline-assembly
#         assembly {
#             start := mul(0x41, index)
#             r := calldataload(add(signatures.offset, start))
#             s := calldataload(add(signatures.offset, add(0x20, start)))
#             v := and(calldataload(add(signatures.offset, add(0x21, start))), 0xff)
#         }
#         require(v == 27 || v == 28, "TeleportOracleAuth/bad-v");
#     }
# }
