%lang starknet

from starkware.cairo.common.cairo_builtins import (HashBuiltin)
from starkware.cairo.common.uint256 import (
  Uint256
)

@contract_interface
namespace IVat:
  func fork(ilk: felt, src: felt, dst: felt, dink: Uint256, dart: Uint256):
  end
  func hope(usr : felt):
  end
  func frob(ilk : felt, u : felt, v : felt, w : felt, dink : Uint256, dart : Uint256):
  end
end

# Vat public vat;
@storage_var
func _vat() -> (res : felt):
end

# constructor(Vat vat_) {
#     vat = vat_;
# }
@constructor
func constructor{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(vat : felt):
    _vat.write(vat)
    return ()
end

# function can_frob(bytes32 ilk, address u, address v, address w, int256 dink, int256 dart) public returns (bool) {
#     string memory sig = "frob(bytes32,address,address,address,int256,int256)";
#     bytes memory data = abi.encodeWithSignature(sig, ilk, u, v, w, dink, dart);
#
#     bytes memory can_call = abi.encodeWithSignature("try_call(address,bytes)", vat, data);
#     (bool ok, bytes memory success) = address(this).call(can_call);
#
#     ok = abi.decode(success, (bool));
#     return ok;
# }
@external
func can_frob{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk : felt, u : felt, v : felt, w : felt, dink : Uint256, dart : Uint256) -> (res : felt):
    let (vat) = _vat.read()
    IVat.frob(vat, ilk, u, v, w, dink, dart)
    return (1)
end

# function can_fork(bytes32 ilk, address src, address dst, int256 dink, int256 dart) public returns (bool) {
#     string memory sig = "fork(bytes32,address,address,int256,int256)";
#     bytes memory data = abi.encodeWithSignature(sig, ilk, src, dst, dink, dart);
#
#     bytes memory can_call = abi.encodeWithSignature("try_call(address,bytes)", vat, data);
#     (bool ok, bytes memory success) = address(this).call(can_call);
#
#     ok = abi.decode(success, (bool));
#     return ok;
# }
@external
func can_fork{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk : felt, src : felt, dst : felt, dink : Uint256, dart : Uint256) -> (res : felt):
    let (vat) = _vat.read()
    IVat.fork(vat, ilk, src, dst, dink, dart)
    return (1)
end

# function frob(bytes32 ilk, address u, address v, address w, int256 dink, int256 dart) public {
#     vat.frob(ilk, u, v, w, dink, dart);
# }
@external
func frob{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk : felt, u : felt, v : felt, w : felt, dink : Uint256, dart : Uint256):
    let (vat) = _vat.read()
    IVat.frob(vat, ilk, u, v, w, dink, dart)
    return ()
end

# function fork(bytes32 ilk, address src, address dst, int256 dink, int256 dart) public {
#     vat.fork(ilk, src, dst, dink, dart);
# }
@external
func fork{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk : felt, src : felt, dst : felt, dink : Uint256, dart : Uint256):
    let (vat) = _vat.read()
    IVat.fork(vat, ilk, src, dst, dink, dart)
    return ()
end

# function hope(address usr) public {
#     vat.hope(usr);
# }
@external
func hope{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(usr : felt):
    let (vat) = _vat.read()
    IVat.hope(vat, usr)
    return ()
end
