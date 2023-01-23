%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256

// bool    has;
@storage_var
func _has() -> (res: felt) {
}
// bytes32 val;
@storage_var
func _val() -> (res: Uint256) {
}

// function peek() public view returns (bytes32, bool) {
//     return (val,has);
// }
@view
func peek{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (
    val: Uint256, has: felt
) {
    let (val) = _val.read();
    let (has) = _has.read();
    return (val, has);
}

// function read() public view returns (bytes32) {
//     bytes32 wut; bool haz;
//     (wut, haz) = peek();
//     require(haz, "haz-not");
//     return wut;
// }
@view
func read{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (wut: Uint256) {
    let (val, has) = peek();
    with_attr error_message("haz-not") {
        assert has = 1;
    }
    return (wut=val);
}

// function poke(bytes32 wut) public {
//     val = wut;
//     has = true;
// }
@external
func poke{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(wut: Uint256) {
    _val.write(wut);
    _has.write(1);
    return ();
}

// function void() public {  // unset the value
//     has = false;
// }
@external
func name{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    _has.write(0);
    return ();
}
