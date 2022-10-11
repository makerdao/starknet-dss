// pragma solidity 0.8.14;

// import "./TeleportGUID.sol";
// import "./utils/EnumerableSet.sol";

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.starknet.common.syscalls import (
    get_contract_address,
    get_caller_address,
    get_block_timestamp,
)
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.math_cmp import is_not_zero
from starkware.cairo.common.math import assert_not_zero
from contracts.starknet.assertions import assert_either, is_eq, le
from contracts.starknet.teleport_GUID import TeleportGUID
from contracts.starknet.enumerableset import EnumerableSet
from contracts.starknet.safe_math import add

// interface TokenLike {
//     function approve(address, uint256) external returns (bool);
//     function transferFrom(address, address, uint256) external returns (bool);
// }
@contract_interface
namespace TokenLike {
    func approve(spender: felt, amount: Uint256) -> (res: felt) {
    }

    func transferFrom(src: felt, dest: felt, amount: Uint256) -> (res: felt) {
    }
}

// interface GatewayLike {
//     function registerMint(TeleportGUID calldata teleportGUID) external;
//     function settle(bytes32 sourceDomain, bytes32 targetDomain, uint256 amount) external;
// }
@contract_interface
namespace GatewayLike {
    func registerMint(teleportGUID: TeleportGUID) {
    }

    func settle(source_domain: felt, target_domain: felt, amount: Uint256) {
    }
}

// mapping (address => uint256) public wards;          // Auth
@storage_var
func _wards(address: felt) -> (res: felt) {
}

// mapping (bytes32 => address) public gateways;       // GatewayLike contracts called by the router for each domain
@storage_var
func _gateways(domain: felt) -> (res: felt) {
}

// Pending DAI to flush per target domain
@storage_var
func _batches(domain: felt) -> (res: Uint256) {
}

// EnumerableSet.Bytes32Set private allDomains;
const SET_ID = 0;
@storage_var
func _allDomains() -> (res: felt) {
}

// The minimum amount of DAI to be flushed per target domain (prevent spam)
@storage_var
func _fdust() -> (res: Uint256) {
}

// uint80  public nonce;
@storage_var
func _nonce() -> (res: felt) {
}

// bytes32   immutable public domain;
@storage_var
func _domain() -> (res: felt) {
}

// address public parent;
@storage_var
func _parentDomain() -> (res: felt) {
}

// TokenLike immutable public dai; // L1 DAI ERC20 token
@storage_var
func _dai() -> (res: felt) {
}

// event Rely(address indexed usr);
@event
func Rely(usr: felt) {
}

// event Deny(address indexed usr);
@event
func Deny(usr: felt) {
}

// event File(bytes32 indexed what, uint256 data);
@event
func File_fdust(what: felt, data: Uint256) {
}

// event File(bytes32 indexed what, address data);
@event
func File_gateway(what: felt, domain: felt, data: felt) {
}

// event InitiateTeleport(TeleportGUID teleport);
@event
func InitiateTeleport(teleport: TeleportGUID) {
}

// event Flush(bytes32 indexed targetDomain, uint256 dai);
@event
func Flush(target_domain: felt, dai: Uint256) {
}

// modifier auth {
//     require(wards[msg.sender] == 1, "TeleportRouter/not-authorized");
//     _;
// }
func auth{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (ward) = _wards.read(caller);
    with_attr error_message("l2_dai_bridge/not-authorized") {
        assert ward = 1;
    }
    return ();
}

// constructor(address dai_) {
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    ward: felt, dai: felt, domain: felt, parent_domain: felt
) {
    // dai = TokenLike(dai_);
    _dai.write(dai);

    // domain = domain_;
    _domain.write(domain);

    // parentDomain = parentDomain_;
    _parentDomain.write(parent_domain);

    // wards[msg.sender] = 1;
    _wards.write(ward, 1);

    let (caller) = get_caller_address();
    // emit Rely(msg.sender);
    Rely.emit(caller);

    return ();
}

// // --- Administration ---
// function rely(address usr) external auth {
@external
func rely{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // wards[usr] = 1;
    _wards.write(usr, 1);

    // emit Rely(usr);
    Rely.emit(usr);

    return ();
}

// function deny(address usr) external auth {
@external
func deny{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    auth();

    // wards[usr] = 0;
    _wards.write(usr, 0);

    // emit Deny(usr);
    Deny.emit(usr);

    return ();
}

// function file(bytes32 what, bytes32 domain, address data) external auth {
@external
func file{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    what: felt, domain: felt, data: felt
) {
    alloc_locals;
    auth();
    with_attr error_message("TeleportRouter/file-unrecognized-param") {
        assert what = 'gateway';
    }

    // address prevGateway = gateways[domain];
    let (prev_gateway) = _gateways.read(domain);

    // if(prevGateway == address(0)) {
    if (prev_gateway == 0) {
        let is_data_not_zero = is_not_zero(data);
        if (is_data_not_zero == 1) {
            EnumerableSet.add(set_id=SET_ID, value=domain);
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
        } else {
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
        }
    } else {
        if (data == 0) {
            EnumerableSet.remove(set_id=SET_ID, value=domain);
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
        } else {
            tempvar pedersen_ptr: HashBuiltin* = pedersen_ptr;
            tempvar syscall_ptr: felt* = syscall_ptr;
            tempvar range_check_ptr = range_check_ptr;
        }
    }

    // gateways[domain] = data;
    _gateways.write(domain, data);

    // emit File(what, domain, data);
    File_gateway.emit(what, domain, data);

    return ();
}

// function file(bytes32 what, uint256 data) external auth {
@external
func file_fdust{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    what: felt, data: Uint256
) {
    auth();

    // if (what == "fdust") {
    //             fdust = data;
    //         } else {
    //             revert("TeleportJoin/file-unrecognized-param");
    //         }
    with_attr error_message("TeleportRouter/file-unrecognized-param") {
        assert what = 'fdust';
    }
    _fdust.write(data);

    // emit File(what, data);
    File_fdust.emit(what, data);

    return ();
}

// function numDomains() external view returns (uint256) {
@view
func numDomains{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (length) = EnumerableSet.length(set_id=SET_ID);
    return (res=length);
}

// function domainAt(uint256 index) external view returns (bytes32) {
@view
func domainAt{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(index: felt) -> (
    res: felt
) {
    let (res) = EnumerableSet.at(set_id=SET_ID, index=index);
    return (res=res);
}

// function hasDomain(bytes32 domain) external view returns (bool) {
@view
func hasDomain{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(domain: felt) -> (
    res: felt
) {
    let (contains) = EnumerableSet.contains(set_id=SET_ID, value=domain);
    return (res=contains);
}

@view
func dai{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _dai.read();
    return (res=res);
}

@view
func nonce{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _nonce.read();
    return (res=res);
}

@view
func fdust{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: Uint256) {
    let (res) = _fdust.read();
    return (res=res);
}

@view
func parentDomain{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (
    res: felt
) {
    let (res) = _parentDomain.read();
    return (res=res);
}

@view
func domain{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
    let (res) = _domain.read();
    return (res=res);
}

@view
func wards{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(user: felt) -> (
    res: felt
) {
    let (res) = _wards.read(user);
    return (res,);
}

@view
func gateways{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(domain: felt) -> (
    res: felt
) {
    let (res) = _gateways.read(domain);
    return (res,);
}

@view
func batches{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(domain: felt) -> (
    res: Uint256
) {
    let (res) = _batches.read(domain);
    return (res,);
}

// function registerMint(TeleportGUID calldata teleportGUID) external {
@external
func registerMint{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    teleportGUID: TeleportGUID
) {
    alloc_locals;
    let (parentDomain) = _parentDomain.read();
    // require(msg.sender == gateways[parentDomain] || msg.sender == gateways[teleportGUID.sourceDomain], "TeleportRouter/sender-not-gateway");    let (parentDomain) = _parentDomain.read();
    with_attr error_message("TeleportRouter/sender-not-gateway") {
        let (caller) = get_caller_address();
        let (parent_gateway) = _gateways.read(parentDomain);
        let (parent_eq) = is_eq(caller, parent_gateway);
        let (source_gateway) = _gateways.read(teleportGUID.source_domain);
        let (gateway_eq) = is_eq(caller, source_gateway);
        assert_either(parent_eq, gateway_eq);
    }

    _registerMint(teleportGUID);

    return ();
}

func _registerMint{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    teleportGUID: TeleportGUID
) {
    let (parentDomain) = _parentDomain.read();
    // address gateway = gateways[teleportGUID.targetDomain];
    // // Use fallback if no gateway is configured for the target domain
    // if (gateway == address(0)) gateway = gateways[parentDomain];
    let (gateway) = get_gateway(teleportGUID.target_domain, parentDomain);

    // require(gateway != address(0), "TeleportRouter/unsupported-target-domain");
    with_attr error_message("TeleportRouter/unsupported-target-domain") {
        assert_not_zero(gateway);
    }

    // GatewayLike(gateway).registerMint(teleportGUID);
    GatewayLike.registerMint(gateway, teleportGUID);
    return ();
}

// function settle(bytes32 sourceDomain, bytes32 targetDomain, uint256 amount) external {
@external
func settle{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    source_domain: felt, target_domain: felt, amount: Uint256
) {
    alloc_locals;
    let (caller) = get_caller_address();
    let (contract_address) = get_contract_address();
    let (parent_domain) = _parentDomain.read();

    // require(msg.sender == gateways[parentDomain] || msg.sender == gateways[sourceDomain], "TeleportRouter/sender-not-gateway");
    with_attr error_message("TeleportRouter/sender-not-gateway") {
        let (parent_gateway) = _gateways.read(parent_domain);
        let (source_gateway) = _gateways.read(source_domain);
        let (parent_eq) = is_eq(caller, parent_gateway);
        let (gateway_eq) = is_eq(caller, source_gateway);
        assert_either(parent_eq, gateway_eq);
    }

    // _settle(msg.sender, sourceDomain, targetDomain, amount);
    _settle(caller, source_domain, target_domain, amount);

    return ();
}

// function _settle(address from, bytes32 sourceDomain, bytes32 targetDomain, uint256 amount) internal {
func _settle{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    from_: felt, source_domain: felt, target_domain: felt, amount: Uint256
) {
    let (parent_domain) = _parentDomain.read();
    let (gateway) = get_gateway(target_domain, parent_domain);

    // require(gateway != address(0), "TeleportRouter/unsupported-target-domain")
    with_attr error_message("TeleportRouter/unsupported-target-domain") {
        assert_not_zero(gateway);
    }

    let (dai) = _dai.read();

    // Forward the DAI to settle to the gateway contract
    // dai.transferFrom(from, gateway, amount);
    TokenLike.transferFrom(dai, from_, gateway, amount);

    // GatewayLike(gateway).settle(sourceDomain, targetDomain, amount);
    GatewayLike.settle(gateway, source_domain, target_domain, amount);
    return ();
}

// function initiateTeleport(
//         bytes32 targetDomain,
//         bytes32 receiver,
//         uint128 amount,
//         bytes32 operator
//     ) public {
@external
func initiateTeleport{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(target_domain: felt, receiver: felt, amount: felt, operator: felt) {
    alloc_locals;
    let (domain) = _domain.read();
    let (nonce) = _nonce.read();
    let (block_timestamp) = get_block_timestamp();
    // TeleportGUID memory teleport = TeleportGUID({
    //         sourceDomain: domain,
    //         targetDomain: targetDomain,
    //         receiver: receiver,
    //         operator: operator,
    //         amount: amount,
    //         nonce: nonce++,
    //         timestamp: uint48(block.timestamp)
    //     });
    let teleport: TeleportGUID = TeleportGUID(
        source_domain=domain,
        target_domain=target_domain,
        receiver=receiver,
        operator=operator,
        amount=Uint256(amount, 0),
        nonce=nonce + 1,
        timestamp=block_timestamp,
    );
    _nonce.write(nonce + 1);

    // batches[targetDomain] += amount;
    let (batch) = _batches.read(target_domain);
    let (new_batch) = add(batch, Uint256(amount, 0));
    _batches.write(target_domain, new_batch);

    let (caller) = get_caller_address();
    let (this) = get_contract_address();
    let (dai) = _dai.read();

    // require(dai.transferFrom(msg.sender, address(this), amount), "TeleportRouter/transfer-failed");
    let (success) = TokenLike.transferFrom(dai, caller, this, Uint256(amount, 0));
    with_attr error_message("TeleportRouter/transfer-failed") {
        assert success = 1;
    }

    // Initiate the censorship-resistant slow-path
    // _registerMint(teleport);
    _registerMint(teleport);

    // Oracle listens to this event for the fast-path
    // emit InitiateTeleport(teleport);
    InitiateTeleport.emit(teleport);

    return ();
}

//
// * @notice Flush batched DAI to the target domain
// * @dev Will initiate a settle operation along the secure, slow routing path
// * @param targetDomain The target domain to settle
// function flush(bytes32 targetDomain) external {
@external
func flush{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(target_domain: felt) {
    alloc_locals;

    // uint256 daiToFlush = batches[targetDomain];
    //     require(daiToFlush >= fdust, "TeleportRouter/flush-dust");
    let (dai_to_flush) = _batches.read(target_domain);
    let (fdust) = _fdust.read();
    with_attr error_message("TeleportRouter/flush-dust") {
        let (valid) = le(fdust, dai_to_flush);
        assert valid = 1;
    }

    // batches[targetDomain] = 0;
    _batches.write(target_domain, Uint256(0, 0));

    // _settle(address(this), domain, targetDomain, daiToFlush);
    let (this) = get_contract_address();
    let (domain) = _domain.read();
    _settle(this, domain, target_domain, dai_to_flush);

    // emit Flush(targetDomain, daiToFlush);
    Flush.emit(target_domain, dai_to_flush);

    return ();
}

func get_gateway{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    targetDomain: felt, parentDomain: felt
) -> (gateway: felt) {
    let (_gateway) = _gateways.read(targetDomain);
    let (_parentGateway) = _gateways.read(parentDomain);
    if (_gateway == 0) {
        return (gateway=_parentGateway);
    } else {
        return (gateway=_gateway);
    }
}
