%lang starknet
# pragma solidity 0.8.14;

# import "./TeleportGUID.sol";
from contracts.starknet.teleport_GUID import TeleportGUID, getGUIDHash
from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.starknet.common.syscalls import (
    get_caller_address,
    get_contract_address,
    get_block_timestamp,
)
from starkware.cairo.common.uint256 import (
    Uint256,
    uint256_check,
    uint256_le,
    uint256_neg,
    uint256_lt,
)
from contracts.starknet.safe_math import (
    Int256,
    add,
    _add,
    sub,
    _sub,
    mul,
    _mul,
    add_signed,
    min,
    _felt_to_uint,
    _uint_to_felt,
)
from contracts.starknet.assertions import eq_0, either, le_int, _ge_0, assert_either, is_eq, check

struct Urn:
    member ink : Uint256  # Locked Collateral  [wad]
    member art : Uint256  # Normalised Debt    [wad]
end

# struct TeleportStatus {
#         bool    blessed;
#         uint248 pending;
#     }
struct TeleportStatus:
    member blessed : felt
    member pending : Uint256
end

# interface VatLike {
#     function dai(address) external view returns (uint256);
#     function live() external view returns (uint256);
#     function urns(bytes32, address) external view returns (uint256, uint256);
#     function frob(bytes32, address, address, address, int256, int256) external;
#     function hope(address) external;
#     function move(address, address, uint256) external;
#     function nope(address) external;
#     function slip(bytes32, address, int256) external;
# }
@contract_interface
namespace VatLike:
    func dai(u : felt) -> (dai : Uint256):
    end

    func live() -> (live : felt):
    end

    func urns(i : felt, u : felt) -> (urn : Urn):
    end

    func frob(i : felt, u : felt, v : felt, w : felt, dink : Uint256, dart : Uint256):
    end

    func hope(usr : felt):
    end

    func move(src : felt, dst : felt, rad : Uint256):
    end

    func nope(usr : felt):
    end

    func slip(ilk : felt, usr : felt, wad : Int256):
    end
end

# interface DaiJoinLike {
#     function dai() external view returns (TokenLike);
#     function exit(address, uint256) external;
#     function join(address, uint256) external;
# }
@contract_interface
namespace DaiJoinLike:
    func dai() -> (res : felt):
    end

    func exit(usr : felt, wad : Uint256):
    end

    func join(usr : felt, wad : Uint256):
    end
end

# interface TokenLike {
#     function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
#     function approve(address, uint256) external returns (bool);
# }
@contract_interface
namespace TokenLike:
    func transferFrom(sender : felt, recipient : felt, amount : Uint256) -> (res : felt):
    end

    func approve(spender : felt, amount : Uint256) -> (res : felt):
    end
end

# interface FeesLike {
#     function getFee(TeleportGUID calldata, uint256, int256, uint256, uint256) external view returns (uint256);
# }
@contract_interface
namespace FeesLike:
    func getFee(
        calldata : TeleportGUID,
        line : Uint256,
        debt : Int256,
        pending : Uint256,
        amtToTake : Uint256,
    ) -> (fees : Uint256):
    end
end

# interface GatewayLike {
#     function registerMint(TeleportGUID calldata teleportGUID) external;
#     function settle(bytes32 sourceDomain, bytes32 targetDomain, uint256 amount) external;
# }
@contract_interface
namespace GatewayLike:
    func registerMint(teleportGUID : TeleportGUID):
    end

    func settle(source_domain : felt, target_domain : felt, amount : Uint256):
    end
end

const MAX_NONCE = 2 ** 80 - 1
# const MAX_UINT = Uint256(2 ** 128 - 1, 2 ** 128 - 1)

# // Primary control for extending Teleport credit
# contract TeleportJoin {
#     mapping (address =>        uint256) public wards;     // Auth
@storage_var
func _wards(user : felt) -> (res : felt):
end
# mapping (bytes32 =>        address) public fees;      // Fees contract per source domain
@storage_var
func _fees(d : felt) -> (fee : felt):
end
# mapping (bytes32 =>        uint256) public line;      // Debt ceiling per source domain
@storage_var
func _lines(d : felt) -> (line : Uint256):
end
# mapping (bytes32 =>         int256) public debt;      // Outstanding debt per source domain (can be < 0 when settlement occurs before mint)
@storage_var
func _debts(d : felt) -> (debt : Int256):
end
# mapping (bytes32 => TeleportStatus) public teleports; // Approved teleports and pending unpaid
@storage_var
func _teleports(hash : felt) -> (teleport : TeleportStatus):
end
# mapping (bytes32 => uint256)        public batches;   // Pending DAI to flush per target domain
@storage_var
func _batches(d : felt) -> (batch : Uint256):
end
# address public vow;
@storage_var
func _vow() -> (vow : felt):
end

# uint256 internal art; // We need to preserve the last art value before the position being skimmed (End)
@storage_var
func _art() -> (art : Uint256):
end

# uint80  public nonce;
@storage_var
func _nonce() -> (nonce : felt):
end

# uint256 public fdust; // The minimum amount of DAI to be flushed per target domain (prevent spam)
@storage_var
func _fdust() -> (fdust : Uint256):
end

# VatLike     immutable public vat;
@storage_var
func _vat() -> (res : felt):
end
# DaiJoinLike immutable public daiJoin;
@storage_var
func _daiJoin() -> (res : felt):
end
# TokenLike   immutable public dai;
@storage_var
func _dai() -> (res : felt):
end
# bytes32     immutable public ilk;
@storage_var
func _ilk() -> (ilk : felt):
end
# bytes32     immutable public domain;
@storage_var
func _domain() -> (domain : felt):
end
# GatewayLike immutable public router;
@storage_var
func _router() -> (router : felt):
end

# uint256 constant public WAD = 10 ** 18;
#     uint256 constant public RAY = 10 ** 27;
const RAY = 10 ** 27
const WAD = 10 ** 18

# event Rely(address indexed usr);
@event
func Rely(user : felt):
end
# event Deny(address indexed usr);
@event
func Deny(user : felt):
end
# event File(bytes32 indexed what, address data);
@event
func File(what : felt, data : Uint256):
end
# event File(bytes32 indexed what, uint256 data);
#     event File(bytes32 indexed what, bytes32 indexed domain, address data);
#     event File(bytes32 indexed what, bytes32 indexed domain, uint256 data);
#     event Register(bytes32 indexed hashGUID, TeleportGUID teleportGUID);
@event
func Register(hashGUID : felt, teleportGUID : TeleportGUID):
end
# event Mint(
#         bytes32 indexed hashGUID, TeleportGUID teleportGUID, uint256 amount, uint256 maxFeePercentage, uint256 operatorFee, address originator
#     );
@event
func Mint(
    hashGUID : felt,
    teleportGUID : TeleportGUID,
    amount : Uint256,
    max_fee_percentage : Uint256,
    operator_fee : Uint256,
    originator : felt,
):
end
# event Settle(bytes32 indexed sourceDomain, uint256 amount);
#     event InitiateTeleport(TeleportGUID teleport);
@event
func InitiateTeleport(teleport : TeleportGUID):
end
# event Flush(bytes32 indexed targetDomain, uint256 dai);
@event
func Flush(target_domain : felt, dai : Uint256):
end

@event
func Settle(source_domain : felt, amount : Uint256):
end

# constructor(address vat_, address daiJoin_, bytes32 ilk_, bytes32 domain_, address router_) {
# wards[msg.sender] = 1;
#         emit Rely(msg.sender);
#         vat = VatLike(vat_);
#         daiJoin = DaiJoinLike(daiJoin_);
#         dai = daiJoin.dai();
#         vat.hope(daiJoin_);
#         dai.approve(daiJoin_, type(uint256).max);
#         ilk = ilk_;
#         domain = domain_;
#         router = GatewayLike(router_);
#         dai.approve(router_, type(uint256).max);
#     }
@constructor
func constructor{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    vat_ : felt, daiJoin_ : felt, ilk_ : felt, domain_ : felt, router_ : felt
):
    let (caller) = get_caller_address()
    _wards.write(caller, 1)
    Rely.emit(caller)
    _vat.write(vat_)
    _daiJoin.write(daiJoin_)

    VatLike.hope(vat_, daiJoin_)
    let (dai) = DaiJoinLike.dai(daiJoin_)
    TokenLike.approve(dai, daiJoin_, Uint256(2 ** 128 - 1, 2 ** 128 - 1))
    _ilk.write(ilk_)
    _domain.write(domain_)
    _router.write(router_)
    TokenLike.approve(dai, router_, Uint256(2 ** 128 - 1, 2 ** 128 - 1))

    return ()
end

# modifier auth {
#         require(wards[msg.sender] == 1, "TeleportJoin/not-authorized");
#         _;
#     }
func auth{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}():
    let (caller) = get_caller_address()
    let (ward) = _wards.read(caller)
    with_attr error_message("TeleportJoin/not-authorized"):
        assert ward = 1
    end
    return ()
end

# function rely(address usr) external auth {
#         wards[usr] = 1;
#         emit Rely(usr);
#     }
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
#         wards[usr] = 0;
#         emit Deny(usr);
#     }
@external
func deny{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(user : felt):
    auth()

    # wards[usr] = 0;
    _wards.write(user, 0)

    # emit Deny(usr);
    Deny.emit(user)

    return ()
end

# function file(bytes32 what, address data) external auth {
#         if (what == "vow") {
#             vow = data;
#         } else {
#             revert("TeleportJoin/file-unrecognized-param");
#         }
#         emit File(what, data);
#     }

# function file(bytes32 what, uint256 data) external auth {
#         if (what == "fdust") {
#             fdust = data;
#         } else {
#             revert("TeleportJoin/file-unrecognized-param");
#         }
#         emit File(what, data);
#     }

# function file(bytes32 what, bytes32 domain_, address data) external auth {
#         if (what == "fees") {
#             fees[domain_] = data;
#         } else {
#             revert("TeleportJoin/file-unrecognized-param");
#         }
#         emit File(what, domain_, data);
#     }

# function file(bytes32 what, bytes32 domain_, uint256 data) external auth {
#         if (what == "line") {
#             require(data <= 2 ** 255 - 1, "TeleportJoin/not-allowed-bigger-int256");
#             line[domain_] = data;
#         } else {
#             revert("TeleportJoin/file-unrecognized-param");
#         }
#         emit File(what, domain_, data);
#     }

# /**
#     * @dev External view function to get the total debt used by this contract [RAD]
#     **/
#     function cure() external view returns (uint256 cure_) {
#         cure_ = art * RAY;
#     }

# /**
#     * @dev Internal function that executes the mint after a teleport is registered
#     * @param teleportGUID Struct which contains the whole teleport data
#     * @param hashGUID Hash of the prev struct
#     * @param maxFeePercentage Max percentage of the withdrawn amount (in WAD) to be paid as fee (e.g 1% = 0.01 * WAD)
#     * @param operatorFee The amount of DAI to pay to the operator
#     * @return postFeeAmount The amount of DAI sent to the receiver after taking out fees
#     * @return totalFee The total amount of DAI charged as fees
#     **/
#     function _mint(
#         TeleportGUID calldata teleportGUID,
#         bytes32 hashGUID,
#         uint256 maxFeePercentage,
#         uint256 operatorFee
#     ) internal returns (uint256 postFeeAmount, uint256 totalFee) {
func _mint{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(
    teleportGUID : TeleportGUID,
    hashGUID : felt,
    max_fee_percentage : Uint256,
    operator_fee : Uint256,
) -> (postFeeAmount : Uint256, totalFee : Uint256):
    alloc_locals

    # require(teleportGUID.targetDomain == domain, "TeleportJoin/incorrect-domain");
    with_attr error_message("TeleportJoin/incorrect-domain"):
        let (domain) = _domain.read()
        assert teleportGUID.target_domain = domain
    end

    let (caller) = get_caller_address()

    # bool vatLive = vat.live() == 1;
    let (vat) = _vat.read()
    let (vat_live) = VatLike.live(vat)

    # uint256 line_ = vatLive ? line[teleportGUID.sourceDomain] : 0;
    let (domain_line) = _lines.read(teleportGUID.source_domain)
    let (line_ : Uint256) = mul(Uint256(vat_live, 0), domain_line)

    # int256 debt_ = debt[teleportGUID.sourceDomain];
    let (debt_ : Int256) = _debts.read(teleportGUID.source_domain)

    # // Stop execution if there isn't anything available to withdraw
    #         uint248 pending = teleports[hashGUID].pending;
    #         if (int256(line_) <= debt_ || pending == 0) {
    #             emit Mint(hashGUID, teleportGUID, 0, maxFeePercentage, operatorFee, msg.sender);
    #             return (0, 0);
    #         }
    let (_teleport : TeleportStatus) = _teleports.read(hashGUID)
    let pending : Uint256 = _teleport.pending
    let (pending_null) = eq_0(pending)
    let (over_ceiling) = le_int(line_, debt_)
    let (nothing_to_withdraw) = either(over_ceiling, pending_null)

    if nothing_to_withdraw == 1:
        Mint.emit(hashGUID, teleportGUID, Uint256(0, 0), max_fee_percentage, operator_fee, caller)
        return (Uint256(0, 0), Uint256(0, 0))
    end

    # uint256 amtToTake = _min(
    #                                 pending,
    #                                 uint256(int256(line_) - debt_)
    #                             );
    let (under_ceiling : Uint256) = _sub(line_, debt_)
    let (amt_to_take : Uint256) = min(pending, under_ceiling)

    # uint256 fee = vatLive ? FeesLike(fees[teleportGUID.sourceDomain]).getFee(teleportGUID, line_, debt_, pending, amtToTake) : 0;
    #         require(fee <= maxFeePercentage * amtToTake / WAD, "TeleportJoin/max-fee-exceed");

    let (domain_fees) = _fees.read(teleportGUID.source_domain)
    let (teleport_fee) = FeesLike.getFee(
        domain_fees, teleportGUID, line_, debt_, pending, amt_to_take
    )
    let (fee : Uint256) = mul(Uint256(vat_live, 0), teleport_fee)

    # // No need of overflow check here as amtToTake is bounded by teleports[hashGUID].pending
    #         // which is already a uint248. Also int256 >> uint248. Then both castings are safe.
    #         debt[teleportGUID.sourceDomain] +=  int256(amtToTake);
    #         teleports[hashGUID].pending     -= uint248(amtToTake);
    let (add_debt : Uint256) = add(debt_, amt_to_take)
    _debts.write(teleportGUID.source_domain, add_debt)
    let (pending_update : Uint256) = sub(_teleport.pending, amt_to_take)

    let new_status = TeleportStatus(blessed=_teleport.blessed, pending=pending_update)
    _teleports.write(hashGUID, new_status)

    # if (debt_ >= 0 || uint256(-debt_) < amtToTake) {
    #             uint256 amtToGenerate = debt_ < 0
    #                                     ? uint256(int256(amtToTake) + debt_) // amtToTake - |debt_|
    #                                     : amtToTake;
    #             // amtToGenerate doesn't need overflow check as it is bounded by amtToTake
    #             vat.slip(ilk, address(this), int256(amtToGenerate));
    #             vat.frob(ilk, address(this), address(this), address(this), int256(amtToGenerate), int256(amtToGenerate));
    #             // Query the actual value as someone might have repaid debt without going through settle (if vat.live == 0 prev frob will revert)
    #             (, art) = vat.urns(ilk, address(this));
    #         }

    let (self) = get_contract_address()

    let (debt_pos) = _ge_0(debt_)
    let (minus_debt) = uint256_neg(debt_)
    let (mint_needed) = le_int(minus_debt, amt_to_take)
    let (should_mint) = either(debt_pos, mint_needed)
    if should_mint == 1:
        let (amt_to_generate : Int256) = get_amount_to_generate(amt_to_take, debt_, debt_pos)
        let (local ilk) = _ilk.read()

        VatLike.slip(vat, ilk, self, amt_to_generate)
        VatLike.frob(vat, ilk, self, self, self, amt_to_generate, amt_to_generate)
        let (urn_ : Urn) = VatLike.urns(vat, ilk, self)
        _art.write(urn_.art)
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    else:
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    end

    # totalFee = fee + operatorFee;
    #         postFeeAmount = amtToTake - totalFee;
    #         daiJoin.exit(bytes32ToAddress(teleportGUID.receiver), postFeeAmount);
    tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
    tempvar syscall_ptr : felt* = syscall_ptr
    tempvar range_check_ptr = range_check_ptr
    tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr

    let (total_fee : Uint256) = add(fee, operator_fee)
    let (post_fee_amount : Uint256) = sub(amt_to_take, total_fee)
    let (local daiJoin) = _daiJoin.read()
    DaiJoinLike.exit(daiJoin, teleportGUID.receiver, post_fee_amount)

    # if (fee > 0) {
    #             vat.move(address(this), vow, fee * RAY);
    #         }

    let (local fee_pos) = uint256_lt(Uint256(0, 0), fee)
    if fee_pos == 1:
        let (value) = mul(Uint256(RAY, 0), fee)
        let (local vow) = _vow.read()
        VatLike.move(vat, self, vow, value)
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    else:
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    end

    # if (operatorFee > 0) {
    #             daiJoin.exit(bytes32ToAddress(teleportGUID.operator), operatorFee);
    #         }
    tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
    tempvar syscall_ptr : felt* = syscall_ptr
    tempvar range_check_ptr = range_check_ptr
    tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr

    let (local operator_fee_pos) = uint256_lt(Uint256(0, 0), operator_fee)
    if operator_fee_pos == 1:
        DaiJoinLike.exit(daiJoin, teleportGUID.operator, operator_fee)
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    else:
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    end

    # emit Mint(hashGUID, teleportGUID, amtToTake, maxFeePercentage, operatorFee, msg.sender);
    #     }
    Mint.emit(hashGUID, teleportGUID, amt_to_take, max_fee_percentage, operator_fee, caller)

    return (total_fee, post_fee_amount)
end

func get_amount_to_generate{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(amt_to_take : Uint256, debt : Uint256, condition) -> (amount_to_generate : Uint256):
    # debt < 0
    if condition == 0:
        # uint256(int256(amtToTake) + debt_) // amtToTake - |debt_|
        let (amt : Uint256) = add(amt_to_take, debt)
        return (amount_to_generate=amt)
    else:
        return (amount_to_generate=amt_to_take)
    end
end

# /**
#     * @dev External authed function that registers the teleport
#     * @param teleportGUID Struct which contains the whole teleport data
#     **/
#     function registerMint(
#         TeleportGUID calldata teleportGUID
#     ) external auth {
#         bytes32 hashGUID = getGUIDHash(teleportGUID);
#         require(!teleports[hashGUID].blessed, "TeleportJoin/already-blessed");
#         teleports[hashGUID].blessed = true;
#         teleports[hashGUID].pending = teleportGUID.amount;
#         emit Register(hashGUID, teleportGUID);
#     }
@external
func registerMint{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    teleportGUID : TeleportGUID
):
    alloc_locals
    auth()
    let (hashGUID) = getGUIDHash(teleportGUID)
    with_attr error_message("TeleportJoin/already-blessed"):
        let (teleport) = _teleports.read(hashGUID)
        assert teleport.blessed = 0
    end
    let new_teleport = TeleportStatus(blessed=1, pending=teleportGUID.amount)
    _teleports.write(hashGUID, new_teleport)

    Register.emit(hashGUID, teleportGUID)
    return ()
end

# /**
#     * @dev External authed function that registers the teleport and executes the mint after
#     * @param teleportGUID Struct which contains the whole teleport data
#     * @param maxFeePercentage Max percentage of the withdrawn amount (in WAD) to be paid as fee (e.g 1% = 0.01 * WAD)
#     * @param operatorFee The amount of DAI to pay to the operator
#     * @return postFeeAmount The amount of DAI sent to the receiver after taking out fees
#     * @return totalFee The total amount of DAI charged as fees
#     **/
#     function requestMint(
#         TeleportGUID calldata teleportGUID,
#         uint256 maxFeePercentage,
#         uint256 operatorFee
#     ) external auth returns (uint256 postFeeAmount, uint256 totalFee) {
#         bytes32 hashGUID = getGUIDHash(teleportGUID);
#         require(!teleports[hashGUID].blessed, "TeleportJoin/already-blessed");
#         teleports[hashGUID].blessed = true;
#         teleports[hashGUID].pending = teleportGUID.amount;
#         emit Register(hashGUID, teleportGUID);
#         (postFeeAmount, totalFee) = _mint(teleportGUID, hashGUID, maxFeePercentage, operatorFee);
#     }
@external
func requestMint{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(teleportGUID : TeleportGUID, max_fee_percentage : Uint256, operator_fee : Uint256) -> (
    post_fee_amount : Uint256, total_fee : Uint256
):
    auth()
    let (hashGUID) = getGUIDHash(teleportGUID)
    with_attr error_message("TeleportJoin/already-blessed"):
        let (teleport) = _teleports.read(hashGUID)
        assert teleport.blessed = 0
    end
    let new_teleport = TeleportStatus(blessed=1, pending=teleportGUID.amount)
    _teleports.write(hashGUID, new_teleport)

    Register.emit(hashGUID, teleportGUID)

    let (post_fee_amount : Uint256, total_fee : Uint256) = _mint(
        teleportGUID, hashGUID, max_fee_percentage, operator_fee
    )

    return (post_fee_amount, total_fee)
end

# /**
#     * @dev External function that executes the mint of any pending and available amount (only callable by operator or receiver)
#     * @param teleportGUID Struct which contains the whole teleport data
#     * @param maxFeePercentage Max percentage of the withdrawn amount (in WAD) to be paid as fee (e.g 1% = 0.01 * WAD)
#     * @param operatorFee The amount of DAI to pay to the operator
#     * @return postFeeAmount The amount of DAI sent to the receiver after taking out fees
#     * @return totalFee The total amount of DAI charged as fees
#     **/
#     function mintPending(
#         TeleportGUID calldata teleportGUID,
#         uint256 maxFeePercentage,
#         uint256 operatorFee
#     ) external returns (uint256 postFeeAmount, uint256 totalFee) {
#         require(bytes32ToAddress(teleportGUID.receiver) == msg.sender ||
#             bytes32ToAddress(teleportGUID.operator) == msg.sender, "TeleportJoin/not-receiver-nor-operator");
#         (postFeeAmount, totalFee) = _mint(teleportGUID, getGUIDHash(teleportGUID), maxFeePercentage, operatorFee);
#     }
@external
func mintPending{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(teleportGUID : TeleportGUID, max_fee_percentage : Uint256, operator_fee : Uint256) -> (
    post_fee_amount : Uint256, total_fee : Uint256
):
    alloc_locals
    with_attr error_message("TeleportJoin/not-receiver-nor-operator"):
        let (caller) = get_caller_address()
        let (is_receiver) = is_eq(teleportGUID.receiver, caller)
        let (is_operator) = is_eq(teleportGUID.operator, caller)
        assert_either(is_receiver, is_operator)
    end

    let (hashGUID) = getGUIDHash(teleportGUID)
    let (post_fee_amount : Uint256, total_fee : Uint256) = _mint(
        teleportGUID, hashGUID, max_fee_percentage, operator_fee
    )

    return (post_fee_amount, total_fee)
end

# /**
#     * @dev External function that repays debt with DAI previously pushed to this contract (in general coming from the bridges)
#     * @param sourceDomain domain where the DAI is coming from
#     * @param targetDomain this domain
#     * @param amount Amount of DAI that is being processed for repayment
#     **/
#     function settle(bytes32 sourceDomain, bytes32 targetDomain, uint256 amount) external {
#         require(targetDomain == domain, "TeleportJoin/incorrect-targetDomain");
#         require(amount <= 2 ** 255, "TeleportJoin/overflow");
#         dai.transferFrom(msg.sender, address(this), amount);
#         daiJoin.join(address(this), amount);
#         if (vat.live() == 1) {
#             (, uint256 art_) = vat.urns(ilk, address(this)); // rate == RAY => normalized debt == actual debt
#             uint256 amtToPayBack = _min(amount, art_);
#             vat.frob(ilk, address(this), address(this), address(this), -int256(amtToPayBack), -int256(amtToPayBack));
#             vat.slip(ilk, address(this), -int256(amtToPayBack));
#             unchecked {
#                 art = art_ - amtToPayBack; // Always safe operation
#             }
#         }
#         debt[sourceDomain] -= int256(amount);
#         emit Settle(sourceDomain, amount);
#     }
@external
func settle{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(source_domain : felt, target_domain : felt, amount : Uint256):
    alloc_locals
    with_attr error_message("TeleportJoin/incorrect-targetDomain"):
        let (domain) = _domain.read()
        assert target_domain = domain
    end

    check(amount)

    let (dai) = _dai.read()
    let (daiJoin) = _daiJoin.read()

    let (caller) = get_caller_address()
    let (self) = get_contract_address()
    TokenLike.transferFrom(dai, caller, self, amount)
    DaiJoinLike.join(daiJoin, self, amount)

    let (vat) = _vat.read()
    let (live) = VatLike.live(vat)

    if live == 1:
        let (ilk) = _ilk.read()
        let (urn_ : Urn) = VatLike.urns(vat, ilk, self)  # rate == RAY => normalized debt == actual debt
        let (amt_to_payback : Uint256) = min(amount, urn_.art)
        let (minus_amt_to_payback : Int256) = uint256_neg(amt_to_payback)
        VatLike.frob(vat, ilk, self, self, self, minus_amt_to_payback, minus_amt_to_payback)
        VatLike.slip(vat, ilk, self, minus_amt_to_payback)

        let (new_art : Uint256) = sub(urn_.art, amt_to_payback)
        _art.write(new_art)
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    else:
        tempvar pedersen_ptr : HashBuiltin* = pedersen_ptr
        tempvar syscall_ptr : felt* = syscall_ptr
        tempvar range_check_ptr = range_check_ptr
        tempvar bitwise_ptr : BitwiseBuiltin* = bitwise_ptr
    end

    let (debt) = _debts.read(source_domain)
    let (new_debt) = sub(debt, amount)
    _debts.write(source_domain, new_debt)

    Settle.emit(source_domain, amount)

    return ()
end

# /**
#     * @notice Initiate Maker teleport
#     * @dev Will fire a teleport event, burn the dai and initiate a censorship-resistant slow-path message
#     * @param targetDomain The target domain to teleport to
#     * @param receiver The receiver address of the DAI on the target domain
#     * @param amount The amount of DAI to teleport
#     **/
#     function initiateTeleport(
#         bytes32 targetDomain,
#         address receiver,
#         uint128 amount
#     ) external {
#         initiateTeleport(
#             targetDomain,
#             addressToBytes32(receiver),
#             amount,
#             0
#         );
#     }
@external
func initiateTeleport{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*
}(target_domain : felt, receiver : felt, amount : felt, operator : felt):
    # TeleportGUID memory teleport = TeleportGUID({
    #             sourceDomain: domain,
    #             targetDomain: targetDomain,
    #             receiver: receiver,
    #             operator: operator,
    #             amount: amount,
    #             nonce: nonce++,
    #             timestamp: uint48(block.timestamp)
    #         });
    let (domain) = _domain.read()
    let (nonce) = _nonce.read()
    let (block_timestamp) = get_block_timestamp()
    let (uamount) = _felt_to_uint(amount)
    let teleport : TeleportGUID = TeleportGUID(
        source_domain=domain,
        target_domain=target_domain,
        receiver=receiver,
        operator=operator,
        amount=uamount,
        nonce=nonce + 1,
        timestamp=block_timestamp,
    )

    # batches[targetDomain] += amount;
    let (batch) = _batches.read(target_domain)
    let (u_amount) = _felt_to_uint(amount)
    let (new_batch : Uint256) = add(batch, u_amount)
    _batches.write(target_domain, new_batch)
    # require(dai.transferFrom(msg.sender, address(this), amount), "DomainHost/transfer-failed");
    with_attr error_message("DomainHost/transfer-failed"):
        let (dai) = _dai.read()
        let (caller) = get_caller_address()
        let (self) = get_contract_address()
        let (success) = TokenLike.transferFrom(dai, caller, self, u_amount)
    end
    # // Initiate the censorship-resistant slow-path
    #         router.registerMint(teleport);
    let (router) = _router.read()
    GatewayLike.registerMint(router, teleport)

    # // Oracle listens to this event for the fast-path
    #         emit InitiateTeleport(teleport);
    InitiateTeleport.emit(teleport)
    return ()
end

# /**
#     * @notice Initiate Maker teleport
#     * @dev Will fire a teleport event, burn the dai and initiate a censorship-resistant slow-path message
#     * @param targetDomain The target domain to teleport to
#     * @param receiver The receiver address of the DAI on the target domain
#     * @param amount The amount of DAI to teleport
#     * @param operator An optional address that can be used to mint the DAI at the destination domain (useful for automated relays)
#     **/
#     function initiateTeleport(
#         bytes32 targetDomain,
#         address receiver,
#         uint128 amount,
#         address operator
#     ) external {
#         initiateTeleport(
#             targetDomain,
#             addressToBytes32(receiver),
#             amount,
#             addressToBytes32(operator)
#         );
#     }

# /**
#     * @notice Initiate Maker teleport
#     * @dev Will fire a teleport event, burn the dai and initiate a censorship-resistant slow-path message
#     * @param targetDomain The target domain to teleport to
#     * @param receiver The receiver address of the DAI on the target domain
#     * @param amount The amount of DAI to teleport
#     * @param operator An optional address that can be used to mint the DAI at the destination domain (useful for automated relays)
#     **/
#     function initiateTeleport(
#         bytes32 targetDomain,
#         bytes32 receiver,
#         uint128 amount,
#         bytes32 operator
#     ) public {
#         TeleportGUID memory teleport = TeleportGUID({
#             sourceDomain: domain,
#             targetDomain: targetDomain,
#             receiver: receiver,
#             operator: operator,
#             amount: amount,
#             nonce: nonce++,
#             timestamp: uint48(block.timestamp)
#         });

# batches[targetDomain] += amount;
#         require(dai.transferFrom(msg.sender, address(this), amount), "DomainHost/transfer-failed");

# // Initiate the censorship-resistant slow-path
#         router.registerMint(teleport);

# // Oracle listens to this event for the fast-path
#         emit InitiateTeleport(teleport);
#     }

# /**
#     * @notice Flush batched DAI to the target domain
#     * @dev Will initiate a settle operation along the secure, slow routing path
#     * @param targetDomain The target domain to settle
#     **/
#     function flush(bytes32 targetDomain) external {
#         uint256 daiToFlush = batches[targetDomain];
#         require(daiToFlush > fdust, "DomainGuest/flush-dust");

# batches[targetDomain] = 0;

# router.settle(domain, targetDomain, daiToFlush);

# emit Flush(targetDomain, daiToFlush);
#     }
@external
func flush{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(target_domain : felt):
    alloc_locals
    let (dai_to_flush : Uint256) = _batches.read(target_domain)
    with_attr error_message("DomainGuest/flush-dust"):
        let (fdust : Uint256) = _fdust.read()
        let (not_dust) = uint256_lt(fdust, dai_to_flush)
    end

    _batches.write(target_domain, Uint256(0, 0))

    let (domain) = _domain.read()
    let (router) = _router.read()
    GatewayLike.settle(router, domain, target_domain, dai_to_flush)

    Flush.emit(target_domain, dai_to_flush)

    return ()
end
# }
