%lang starknet

from starkware.cairo.common.cairo_builtins import (HashBuiltin, SignatureBuiltin)
from starkware.starknet.common.syscalls import (get_caller_address)
from starkware.cairo.common.math import (assert_lt)
from starkware.cairo.common.math_cmp import (is_not_zero)
from starkware.cairo.common.uint256 import (Uint256)
from starkware.cairo.common.signature import verify_ecdsa_signature
from starkware.cairo.common.registers import get_fp_and_pc
from starkware.cairo.common.hash import hash2

from contracts.teleport_GUID import (TeleportGUID)

# import "./TeleportGUID.sol";

# interface TeleportJoinLike {
#     function requestMint(
#         TeleportGUID calldata teleportGUID,
#         uint256 maxFeePercentage,
#         uint256 operatorFee
#     ) external returns (uint256 postFeeAmount, uint256 totalFee);
# }
@contract_interface
namespace TeleportJoinLike:
  func request_mint(
    teleport_GUID: TeleportGUID, max_fee_percentage: Uint256, operator_fee: Uint256
  ) -> (post_fee_amount: Uint256, totalFee: Uint256):
  end
end

struct Signature:
  member pk: felt
  member r: felt
  member s: felt
end


# // TeleportOracleAuth provides user authentication for TeleportJoin, by means of Maker Oracle Attestations
# contract TeleportOracleAuth {

#     mapping (address => uint256) public wards;   // Auth
@storage_var
func _wards(usr : felt) -> (res : felt):
end

@view
func wards{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(usr : felt) -> (res : felt):
    let (res) = _wards.read(usr)
    return (res)
end

#     mapping (address => uint256) public signers; // Oracle feeds
@storage_var
func _signers(address: felt) -> (res : felt):
end

@view
func signers{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(address: felt) -> (res: felt):
      let (res) = _signers.read(address)
      return (res)
end


#     TeleportJoinLike immutable public teleportJoin;
@storage_var
func _teleport_join() -> (join : felt):
end

@view
func teleport_join{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }() -> (res : felt):
    let (res) = _teleport_join.read()
    return (res)
end

#     uint256 public threshold;
@storage_var
func _threshold() -> (res : felt):
end

@view
func threshold{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }() -> (res : felt):
    let (res) = _threshold.read()
    return (res)
end

# event Rely(address indexed usr);
@event
func Rely(usr : felt):
end

# event Deny(address indexed usr);
@event
func Deny(usr : felt):
end

#     event File(bytes32 indexed what, uint256 data);
@event
func File(what : felt, data: felt):
end

#     event SignersAdded(address[] signers);
@event
func SignersAdded(signers_len: felt, signers : felt*):
end

#     event SignersRemoved(address[] signers);
@event
func SignersRemoved(signers_len: felt, signers : felt*):
end

#     modifier auth {
#         require(wards[msg.sender] == 1, "TeleportOracleAuth/not-authorized");
#         _;
#     }
func auth{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
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
func constructor{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(
    ward : felt,
    teleport_join_: felt
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
func rely{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(usr : felt):
    auth()

    # wards[usr] = 1;
    _wards.write(usr, 1)

    # emit Rely(usr);
    Rely.emit(usr)

    return ()
end


# function deny(address usr) external auth {
@external
func deny{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(usr : felt):
    auth()

    # wards[usr] = 0;
    _wards.write(usr, 0)

    # emit Deny(usr);
    Deny.emit(usr)

    return ()
end

# function file(bytes32 what, uint256 data) external auth {
@external
func file{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(what : felt, data : felt):
    auth()

  #if (what == "threshold") {
  #    threshold = data;
  #} else {
  #  revert("TeleportOracleAuth/file-unrecognized-param");
  #}
    with_attr error_message("TeleportRouter/file-unrecognized-param"):
      assert what = 'threshold'
    end
    _threshold.write(data)

    # emit File(what, data);
    File.emit(what, data)

    return()
end


# function addSigners(address[] calldata signers_) external auth {
@external
func add_signers{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(signers__len: felt, signers_: felt*):
    alloc_locals
    auth()
    add_signers_internal(signers__len - 1, signers_ + 1)
    SignersAdded.emit(signers__len, signers_)
    return()
end


func add_signers_internal{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(signers__len: felt, signers_: felt*):
    # for(uint i; i < signers_.length; i++) {
    #     signers[signers_[i]] = 1;
    # }
    if signers__len == 0:
      return ()
    end
    _signers.write(signers_[0], 1)
    add_signers_internal(signers__len - 1, signers_ + 1)
    return()
end


# function removeSigners(address[] calldata signers_) external auth {
@external
func remove_signers{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(signers__len: felt, signers_: felt*):
    alloc_locals
    auth()
    remove_signers_internal(signers__len - 1, signers_ + 1)
    SignersRemoved.emit(signers__len, signers_)
    return()
end

func remove_signers_internal{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(signers__len: felt, signers_: felt*):
    # for(uint i; i < signers_.length; i++) {
    #     signers[signers_[i]] = 0;
    # }
    if signers__len == 0:
      return ()
    end
    _signers.write(signers_[0], 1)
    add_signers_internal(signers__len - 1, signers_ + 1)
    return()
end


# function requestMint(
#     TeleportGUID calldata teleportGUID,
#     bytes calldata signatures,
#     uint256 maxFeePercentage,
#     uint256 operatorFee
@external
func request_mint{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr,
    ecdsa_ptr : SignatureBuiltin*
  }(
    teleport_GUID : TeleportGUID,
    signatures_len: felt,
    signatures: Signature*,
    max_fee_percentage: Uint256,
    operator_fee: Uint256
  ) -> (
    post_fee_amount: Uint256,
    operator_fee: Uint256
  ):
    alloc_locals

    # TODO: check(max_fee_percentage), check(operator_fee)

    # require(bytes32ToAddress(teleportGUID.receiver) == msg.sender ||
    #   bytes32ToAddress(teleportGUID.operator) == msg.sender, "TeleportOracleAuth/not-receiver-nor-operator");
    let (caller) = get_caller_address()
    let (not_receiver) = is_not_zero(caller - teleport_GUID.receiver)
    if not_receiver == 1:
      with_attr error_message("teleport_oracle_auth/not-receiver-nor-operator"):
        assert caller = teleport_GUID.operator
      end
    end

    # require(isValid(getSignHash(teleportGUID), signatures, threshold), "TeleportOracleAuth/not-enough-valid-sig");
    let (__fp__, _) = get_fp_and_pc()
    let (local threshold_) = _threshold.read()
    let (message) = teleport_hash(&teleport_GUID)
    validate(message, signatures_len, signatures, threshold_)

    # (postFeeAmount, totalFee) = teleportJoin.requestMint(teleportGUID, maxFeePercentage, operatorFee);
    let (teleport_join_) = _teleport_join.read()
    let (post_fee_amount, operator_fee) = TeleportJoinLike.request_mint(
      teleport_join_,
      teleport_GUID,
      max_fee_percentage,
      operator_fee
    )

    return (post_fee_amount, operator_fee)

end

func teleport_hash{pedersen_ptr : HashBuiltin*}(t : TeleportGUID*) -> (res: felt):
  # h(source_domain, h(target_domain, h(receiver, h(operator, h(amount, h(nonce, timestamp))))))

    let hash_ptr = pedersen_ptr
    with hash_ptr:
      let (_hash1) = hash2(t.timestamp, t.nonce)
      let (_hash2) = hash2(_hash1, t.amount)
      let (_hash3) = hash2(_hash2, t.operator)
      let (_hash4) = hash2(_hash3, t.receiver)
      let (_hash5) = hash2(_hash4, t.target_domain)
      let (hash) = hash2(_hash5, t.source_domain)
    end

    let pedersen_ptr = hash_ptr
    return (hash)
end

#     /**
#      * @notice Returns true if `signatures` contains at least `threshold_` valid signatures of a given `signHash`
#      * @param signHash The signed message hash
#      * @param signatures The byte array of concatenated signatures ordered by increasing signer addresses.
#      * Each signature is {bytes32 r}{bytes32 s}{uint8 v}
#      * @param threshold_ The minimum number of valid signatures required for the method to return true
#      * @return valid Signature verification res
#      */
#     function isValid(bytes32 signHash, bytes calldata signatures, uint threshold_) public view returns (bool valid) {
#         uint256 count = signatures.length / 65;
#         require(count >= threshold_, "TeleportOracleAuth/not-enough-sig");

#         uint8 v;
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
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr,
    ecdsa_ptr : SignatureBuiltin*
  }(
    message : felt,
    signatures_len: felt,
    signatures: Signature*,
    threshold_: felt
  ):

    if threshold_ == 0:
        return ()
    end

    assert_lt(0, signatures_len)

    let sig: Signature = signatures[0]

    let (valid_sig) = _signers.read(sig.pk)

    assert valid_sig = 1

    verify_ecdsa_signature(message, sig.pk, sig.r, sig.s)

    validate(message, signatures_len - 1, signatures + 1, threshold_ - 1)

    return ()

end


#     /**
#      * @notice This has to match what oracles are signing
#      * @param teleportGUID The teleport GUID to calculate hash
#      */
#     function getSignHash(TeleportGUID memory teleportGUID) public pure returns (bytes32 signHash) {
#         signHash = keccak256(abi.encodePacked(
#             "\x19Ethereum Signed Message:\n32",
#             getGUIDHash(teleportGUID)
#         ));
#     }
