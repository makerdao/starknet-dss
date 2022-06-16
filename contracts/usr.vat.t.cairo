%lang starknet

# contract Usr {
#     Vat public vat;
@storage_var
func _vat() -> (res : felt):
end

#     constructor(Vat vat_) {
#         vat = vat_;
#     }
@constructor
func constructor(vat : felt):
  _vat.write(vat)
end

#     function try_call(address addr, bytes calldata data) external returns (bool) {
#         bytes memory _data = data;
#         assembly {
#             let ok := call(gas(), addr, 0, add(_data, 0x20), mload(_data), 0, 0)
#             let free := mload(0x40)
#             mstore(free, ok)
#             mstore(0x40, add(free, 32))
#             revert(free, 32)
#         }
#     }
func try_call(addr : felt, data : felt) -> (res: felt):
    
end


#     function can_frob(bytes32 ilk, address u, address v, address w, int256 dink, int256 dart) public returns (bool) {
#         string memory sig = "frob(bytes32,address,address,address,int256,int256)";
#         bytes memory data = abi.encodeWithSignature(sig, ilk, u, v, w, dink, dart);
# 
#         bytes memory can_call = abi.encodeWithSignature("try_call(address,bytes)", vat, data);
#         (bool ok, bytes memory success) = address(this).call(can_call);
# 
#         ok = abi.decode(success, (bool));
#         return ok;
#     }
@external
func can_frob(ilk : felt, u : felt, v : felt, w : felt, dink : Uint256, dart : Uint256) -> (res : felt):
    let (res,) = IVat.frob(ilk, u, v, w, dink, dart)
    assert res = 1
    return (res)
end

#     function can_fork(bytes32 ilk, address src, address dst, int256 dink, int256 dart) public returns (bool) {
#         string memory sig = "fork(bytes32,address,address,int256,int256)";
#         bytes memory data = abi.encodeWithSignature(sig, ilk, src, dst, dink, dart);
# 
#         bytes memory can_call = abi.encodeWithSignature("try_call(address,bytes)", vat, data);
#         (bool ok, bytes memory success) = address(this).call(can_call);
# 
#         ok = abi.decode(success, (bool));
#         return ok;
#     }
@external
func can_fork(ilk : felt, src : felt, dst : felt, dink : Uint256, dart : Uint256) -> (res : felt):
    let (vat) = _vat.read()
    let (res,) = IVat(vat).fork(ilk, src, dst, dink, dart)
    assert res = 1
    return (res)
end

#     function frob(bytes32 ilk, address u, address v, address w, int256 dink, int256 dart) public {
#         vat.frob(ilk, u, v, w, dink, dart);
#     }
func frob(ilk : felt, u : felt, v : felt, w : felt, dink : Uint256, dart : Uint256):
    let (vat) = _vat.read()
    IVat(vat).frob(ilk, u, v, w, dink, dart)
end

#     function fork(bytes32 ilk, address src, address dst, int256 dink, int256 dart) public {
#         vat.fork(ilk, src, dst, dink, dart);
#     }
func fork(ilk : felt, src : felt, dst : felt, dink : Uint256, dart : Uint256):
    let (vat) = _vat.read()
    IVat(vat).fork(ilk, src, dst, dink, dart)
end

#     function hope(address usr) public {
#         vat.hope(usr);
#     }
func hope(usr : felt):
    let (vat) = _vat.read()
    IVat(vat).hope(usr)
end
# }
