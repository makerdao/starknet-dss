# pragma solidity 0.8.14;

# import "./TeleportGUID.sol";
# import "./utils/EnumerableSet.sol";

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.starknet.common.syscalls import (get_contract_address, get_caller_address)
from starkware.cairo.common.uint256 import (Uint256)
from starkware.cairo.common.math_cmp import (is_not_zero)
from contracts.assertions import (assert_either)
from contracts.teleport_GUID import (TeleportGUID)
from starkware.cairo.common.math import assert_not_zero

# interface TokenLike {
#     function approve(address, uint256) external returns (bool);
#     function transferFrom(address, address, uint256) external returns (bool);
# }
@contract_interface
namespace TokenLike:
  func approve(spender : felt, amount : Uint256) -> (res : felt):
  end

  func transferFrom(src : felt, dest : felt, amount : Uint256) -> (res : felt):
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


# mapping (address => uint256) public wards;          // Auth
@storage_var
func _wards(address : felt) -> (res : felt):
end

@view
func wards{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(user : felt) -> (res : felt):
    let (res) = _wards.read(user)
    return (res)
end

# mapping (bytes32 => address) public gateways;       // GatewayLike contracts called by the router for each domain
@storage_var
func _gateways(domain : felt) -> (res : felt):
end

@view
func gateways{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(domain: felt) -> (res: felt):
      let (gateway) = _gateways.read(domain)
      return (gateway)
end
# TODO
# EnumerableSet.Bytes32Set private allDomains;
# @storage_var
# func _allDomains() -> ():
# end

# address public parent;
@storage_var
func _parent() -> (res : felt):
end

@view
func parent{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }() -> (res : felt):
    let (res) = _parent.read()
    return (res)
end

# TokenLike immutable public dai; // L1 DAI ERC20 token
@storage_var
func _dai() -> (res : felt):
end

@view
func dai{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }() -> (res : felt):
    let (res) = _dai.read()
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

# event File(bytes32 indexed what, bytes32 indexed domain, address data);
@event
func File_gateway(what : felt, domain : felt, data : felt):
end

# event File(bytes32 indexed what, address data);
@event
func File(what : felt, data : felt):
end

# modifier auth {
#     require(wards[msg.sender] == 1, "TeleportRouter/not-authorized");
#     _;
# }
func auth{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    let (caller) = get_caller_address()
    let (ward) = _wards.read(caller)
    with_attr error_message("l2_dai_bridge/not-authorized"):
      assert ward = 1
    end
    return ()
end

# constructor(address dai_) {
@constructor
func constructor{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(
    dai : felt
  ):
    # dai = TokenLike(dai_);
    _dai.write(dai)

    let (caller) = get_caller_address()

    # wards[msg.sender] = 1;
    _wards.write(caller, 1)

    # emit Rely(msg.sender);
    Rely.emit(caller)

    return ()
end

# // --- Administration ---
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
  }(user : felt):
    auth()

    # wards[usr] = 0;
    _wards.write(user, 0)

    # emit Deny(usr);
    Deny.emit(user)

    return ()
end


# function file(bytes32 what, bytes32 domain, address data) external auth {
@external
func file_gateway{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(
    what : felt,
    domain : felt,
    data : felt
  ):
    # #address prevGateway = gateways[domain];
    # let prev_gateway = _gateways.read(domain)

    # # if(prevGateway == address(0)) {
    # if prev_gateway == 0:
    #   # if(data != address(0)) allDomains.add(domain);
    #   let (is_data_zero) = is_not_zero(data)
    #   if is_data_zero == 0:
    #     # allDomains.add(domain); TODO
    #   end
    # else:
    #   # if(data == address(0)) allDomains.remove(domain);
    #   if data == 0:
    #     # allDomains.remove(domain); TODO
    #   end
    # end

    # gateways[domain] = data;
    _gateways.write(domain, data)

    # else revert("TeleportRouter/file-unrecognized-param");
    with_attr error_message("TeleportRouter/file-unrecognized-param"):
        assert what = 'gateway'
    end

    # emit File(what, domain, data);
    File_gateway.emit(what, domain, data)

    return ()
end

# function file(bytes32 what, address data) external auth {
@external
func file{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(
    what : felt,
    data : felt
  ):
    auth()

    # if (what == "parent") parent = data;
    # else revert("TeleportRouter/file-unrecognized-param");
    with_attr error_message("TeleportRouter/file-unrecognized-param"):
      assert what = 'parent'
    end
    _parent.write(data)

    # emit File(what, data);
    File.emit(what, data)

    return()
end

# # function numDomains() external view returns (uint256) {
# @view
# func numDomains{
#     syscall_ptr : felt*,
#     pedersen_ptr : HashBuiltin*,
#     range_check_ptr
#   }() -> (res : felt):
#     # return allDomains.length(); TODO
# end

# # function domainAt(uint256 index) external view returns (bytes32) {
# @view
# func domainAt{
#     syscall_ptr : felt*,
#     pedersen_ptr : HashBuiltin*,
#     range_check_ptr
#   }(index : felt):
#     # return allDomains.at(index); TODO
# end

# # function hasDomain(bytes32 domain) external view returns (bool) {
# @view
# func hasDomain{
#     syscall_ptr : felt*,
#     pedersen_ptr : HashBuiltin*,
#     range_check_ptr
#   }(domain : felt):
#     # return allDomains.contains(domain); TODO
# end

# function registerMint(TeleportGUID calldata teleportGUID) external {
@external
func registerMint{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(teleport_GUID : TeleportGUID):
    alloc_locals

    # require(msg.sender == parent || msg.sender == gateways[teleportGUID.sourceDomain], "TeleportRouter/sender-not-gateway");
    with_attr error_message("TeleportRouter/sender-not-gateway"):
      let (caller) = get_caller_address()
      let (parent_) = _parent.read()
      let (parent_eq) = is_not_zero(caller - parent_)
      let (source_gateway) = _gateways.read(teleport_GUID.source_domain)
      let (gateway_eq) = is_not_zero(caller - source_gateway)
      assert_either(parent_eq, gateway_eq)
    end

    # address gateway = gateways[teleportGUID.targetDomain];
    let (gateway) = _gateways.read(teleport_GUID.target_domain)

    # if (gateway == address(0)) gateway = parent;
    let (gateway) = nvl(gateway, parent_)

    # require(gateway != address(0), "TeleportRouter/unsupported-target-domain");
    with_attr error_message("TeleportRouter/unsupported-target-domain"):
        assert_not_zero(gateway)
    end

    # GatewayLike(gateway).registerMint(teleportGUID);
    GatewayLike.registerMint(gateway, teleport_GUID)

    return ()
end



# function settle(bytes32 sourceDomain, bytes32 targetDomain, uint256 amount) external {
@external
func settle{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(
    source_domain : felt,
    target_domain : felt,
    amount : Uint256
  ):

    alloc_locals

    let (caller) = get_caller_address()
    let (contract_address) = get_contract_address()
    let (parent_) = _parent.read()

    # require(msg.sender == parent || msg.sender == gateways[sourceDomain], "TeleportRouter/sender-not-gateway");
    with_attr error_message("TeleportRouter/sender-not-gateway"):
      let (parent_eq) = is_not_zero(caller - parent_)
      let (source_gateway) = _gateways.read(source_domain)
      let (gateway_eq) = is_not_zero(caller - source_gateway)
      assert_either(parent_eq, gateway_eq)
    end

    # address gateway = gateways[targetDomain];
    let (gateway) = _gateways.read(target_domain)

    let (gateway) = nvl(gateway, parent_)

    # require(gateway != address(0), "TeleportRouter/unsupported-target-domain")
    with_attr error_message("TeleportRouter/unsupported-target-domain"):
      assert_not_zero(gateway)
    end

    let (dai) = _dai.read()

    # dai.transferFrom(msg.sender, address(this), amount);
    TokenLike.transferFrom(dai, caller, contract_address, amount)

    # dai.approve(gateway, amount);
    TokenLike.approve(dai, gateway, amount)

    # GatewayLike(gateway).settle(sourceDomain, targetDomain, amount);
    GatewayLike.settle(gateway, source_domain, target_domain, amount)

    return ()
end

func nvl(a, b) -> (res):
  if a == 0:
    return (b)
  end
  return (a)
end