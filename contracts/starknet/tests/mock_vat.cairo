%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin, BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256, uint256_check, uint256_le
from starkware.starknet.common.syscalls import get_caller_address
from contracts.starknet.safe_math import Int256, add, _add, sub, _sub, mul, _mul, add_signed
from contracts.starknet.assertions import (
    assert_either,
    either,
    both,
    assert_both,
    not_0,
    assert_not_0,
    assert_0,
    ge,
    _ge_0,
    assert_le,
    _le_0,
    eq_0,
    check,
)

const RAY = 10 ** 27;

struct Urn {
    ink: Uint256,  // Locked Collateral  [wad]
    art: Uint256,  // Normalised Debt    [wad]
}

@storage_var
func _can(b: felt, u: felt) -> (res: felt) {
}

@storage_var
func _live() -> (live: felt) {
}

@storage_var
func _urns(i: felt, u: felt) -> (urn: Urn) {
}

@view
func urns{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(i: felt, u: felt) -> (
    urn: Urn
) {
    let (urn) = _urns.read(i, u);
    return (urn,);
}

@view
func dai{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(u: felt) -> (
    dai: Uint256
) {
    let (dai) = _dai.read(u);
    return (dai,);
}

@view
func live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (live: felt) {
    let (live) = _live.read();
    return (live,);
}

@external
func hope{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(usr: felt) {
    let (sender) = get_caller_address();
    _can.write(sender, usr, 1);
    return ();
}

@external
func cage{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    _live.write(0);
    return ();
}

@storage_var
func _gem(i: felt, u: felt) -> (gem: Uint256) {
}

@storage_var
func _dai(u: felt) -> (dai: Uint256) {
}

func require_live{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    // require(live == 1, "Vat/not-live");
    with_attr error_message("Vat/not-live") {
        let (live) = _live.read();
        assert live = 1;
    }

    return ();
}

@external
func wish{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    bit: felt, user: felt
) -> (res: felt) {
    // return either(bit == usr, can[bit][usr] == 1);
    if (bit == user) {
        return (res=1);
    }
    let (res) = _can.read(bit, user);
    return (res,);
}

// function frob(bytes32 i, address u, address v, address w, int256 dink, int256 dart) external {
//         require(live == 1, "Vat/not-live");

// Urn memory urn = urns[i][u];

// urn.ink = add(urn.ink, dink);
//         urn.art = add(urn.art, dart);

// int256 dtab = mul(RAY, dart);

// gem[i][v] = sub(gem[i][v], dink);
//         dai[w]    = add(dai[w],    dtab);

// urns[i][u] = urn;
//     }
@external
func frob{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(i: felt, u: felt, v: felt, w: felt, dink: Int256, dart: Int256) {
    alloc_locals;
    require_live();
    let (urn) = _urns.read(i, u);

    let (ink) = _add(urn.ink, dink);
    let (art) = _add(urn.art, dart);
    _urns.write(i, u, Urn(ink, art));

    let (dtab) = _mul(Uint256(RAY, 0), dart);

    let (gem) = _gem.read(i, v);
    let (gem) = _sub(gem, dink);
    _gem.write(i, v, gem);

    let (dai) = _dai.read(w);
    let (dai) = _add(dai, dtab);
    _dai.write(w, dai);

    _urns.write(i, u, Urn(ink, art));

    return ();
}

// function move(address src, address dst, uint256 rad) external {
//         require(wish(src, msg.sender), "Vat/not-allowed");
//         dai[src] = sub(dai[src], rad);
//         dai[dst] = add(dai[dst], rad);
//     }
@external
func move{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(src: felt, dst: felt, rad: Uint256) {
    alloc_locals;

    check(rad);

    let (caller) = get_caller_address();
    let (src_consents) = wish(src, caller);
    with_attr error_message("Vat/not-allowed") {
        assert src_consents = 1;
    }

    let (dai_src) = _dai.read(src);
    let (dai_src) = sub(dai_src, rad);
    _dai.write(src, dai_src);

    let (dai_dst) = _dai.read(dst);
    let (dai_dst) = add(dai_dst, rad);
    _dai.write(dst, dai_dst);
    return ();
}

// function slip(bytes32 ilk, address usr, int256 wad) external {
//         gem[ilk][usr] = add(gem[ilk][usr], wad);
//     }
@external
func slip{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(ilk: felt, usr: felt, wad: Int256) {
    alloc_locals;
    let (gem) = _gem.read(ilk, usr);
    let (gem) = _add(gem, wad);
    _gem.write(ilk, usr, gem);
    return ();
}

// function suck(address, address v, uint256 rad) external {
//         dai[v] = add(dai[v], rad);
//     }
@external
func suck{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr, bitwise_ptr: BitwiseBuiltin*
}(u: felt, v: felt, rad: Uint256) {
    alloc_locals;
    let (dai) = _dai.read(v);
    let (dai) = add(dai, rad);
    _dai.write(v, dai);

    return ();
}
