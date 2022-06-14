%lang starknet
%builtins pedersen range_check

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.uint256 import (
  Uint256,
  uint256_add,
  uint256_sub,
  uint256_mul,
  uint256_eq,
  uint256_le,
  uint256_check
)
from starkware.starknet.common.syscalls import (get_caller_address)

# contract Vat {


#     // --- Auth ---
#     mapping (address => uint) public wards;
#     function rely(address usr) external auth { require(live == 1, "Vat/not-live"); wards[usr] = 1; }
#     function deny(address usr) external auth { require(live == 1, "Vat/not-live"); wards[usr] = 0; }
#     modifier auth {
#   require(wards[msg.sender] == 1, "Vat/not-authorized");
#   _;
#     }

@event
func Rely(user : felt):
end

@event
func Deny(user : felt):
end

@storage_var
func _wards(user : felt) -> (res : felt):
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

@external
func rely{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(user : felt):
    auth()
    _wards.write(user, 1)
    Rely.emit(user)
    return ()
end

@external
func deny{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(user : felt):
    auth()
    _wards.write(user, 0)
    Deny.emit(user)
    return ()
end


#     mapping(address => mapping (address => uint)) public can;
@storage_var
func _can(u: felt) -> (res : felt):
end

#     function hope(address usr) external { can[msg.sender][usr] = 1; }
#     function nope(address usr) external { can[msg.sender][usr] = 0; }

#     function wish(address bit, address usr) internal view returns (bool) {
#   return either(bit == usr, can[bit][usr] == 1);
#     }
func wish(bit: felt, usr: felt) -> (res: felt):
    # TODO: implement
    return (1)
end



#     struct Ilk {
#   uint256 Art;   // Total Normalised Debt     [wad]
#   uint256 rate;  // Accumulated Rates         [ray]
#   uint256 spot;  // Price with Safety Margin  [ray]
#   uint256 line;  // Debt Ceiling              [rad]
#   uint256 dust;  // Urn Debt Floor            [rad]
#     }
struct Ilk:
    member Art: Uint256   # Total Normalised Debt     [wad]
    member rate: Uint256  # Accumulated Rates         [ray]
    member spot: Uint256  # Price with Safety Margin  [ray]
    member line: Uint256  # Debt Ceiling              [rad]
    member dust: Uint256  # Urn Debt Floor            [rad]
end

#     struct Urn {
#   uint256 ink;   // Locked Collateral  [wad]
#   uint256 art;   // Normalised Debt    [wad]
#     }
struct Urn:
    member ink: Uint256 # Locked Collateral  [wad]
    member art: Uint256 # Normalised Debt    [wad]
end

#     mapping (bytes32 => Ilk)                       public ilks;
@storage_var
func _ilks(i: felt) -> (ilk : Ilk):
end

#     mapping (bytes32 => mapping (address => Urn )) public urns;
@storage_var
func _urns(i: felt, u: felt) -> (urn : Urn):
end

#     mapping (bytes32 => mapping (address => uint)) public gem;  // [wad]
@storage_var
func _gem(i: felt, u: felt) -> (gem : Uint256):
end

#     mapping (address => uint256)                   public dai;  // [rad]
@storage_var
func _dai(u: felt) -> (dai : Uint256):
end

#     mapping (address => uint256)                   public sin;  // [rad]
@storage_var
func _sin(u: felt) -> (sin : Uint256):
end

#     uint256 public debt;  // Total Dai Issued    [rad]
@storage_var
func _debt() -> (debt : Uint256):
end

#     uint256 public vice;  // Total Unbacked Dai  [rad]
@storage_var
func _vice() -> (vice: Uint256):
end

#     uint256 public Line;  // Total Debt Ceiling  [rad]
@storage_var
func _Line() -> (Line: Uint256):
end

#     uint256 public live;  // Active Flag
@storage_var
func _live() -> (live: felt):
end

@view
func ilks{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(i: felt) -> (ilk : Ilk):
    let (ilk)= _ilks.read(i)
    return (ilk)
end

#     // --- Init ---
#     constructor() public {
#   wards[msg.sender] = 1;
#   live = 1;
#     }

#     // --- Math ---
#     function add(uint x, int y) internal pure returns (uint z) {
#   z = x + uint(y);
#   require(y >= 0 || z <= x);
#   require(y <= 0 || z >= x);
#     }
#     function sub(uint x, int y) internal pure returns (uint z) {
#   z = x - uint(y);
#   require(y <= 0 || z <= x);
#   require(y >= 0 || z >= x);
#     }
#     function mul(uint x, int y) internal pure returns (int z) {
#   z = int(x) * y;
#   require(int(x) >= 0);
#   require(y == 0 || z / y == int(x));
#     }
#     function add(uint x, uint y) internal pure returns (uint z) {
#   require((z = x + y) >= x);
#     }
#     function sub(uint x, uint y) internal pure returns (uint z) {
#   require((z = x - y) <= x);
#     }
#     function mul(uint x, uint y) internal pure returns (uint z) {
#   require(y == 0 || (z = x * y) / y == x);
#     }

#     // --- Administration ---
#     function init(bytes32 ilk) external auth {
#   require(ilks[ilk].rate == 0, "Vat/ilk-already-init");
#   ilks[ilk].rate = 10 ** 27;
#     }

#     function file(bytes32 what, uint data) external auth {
#   require(live == 1, "Vat/not-live");
#   if (what == "Line") Line = data;
#   else revert("Vat/file-unrecognized-param");
#     }

#     function file(bytes32 ilk, bytes32 what, uint data) external auth {
#   require(live == 1, "Vat/not-live");
#   if (what == "spot") ilks[ilk].spot = data;
#   else if (what == "line") ilks[ilk].line = data;
#   else if (what == "dust") ilks[ilk].dust = data;
#   else revert("Vat/file-unrecognized-param");
#     }


#     function cage() external auth {
func cage{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }():
    auth()

    _live.write(0)
    return ()
end

#     // --- Fungibility ---
#     function slip(bytes32 ilk, address usr, int256 wad) external auth {
func slip{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        ilk: felt, usr: felt, wad: Uint256
    ):
    alloc_locals

    auth()

    # gem[ilk][usr] = add(gem[ilk][usr], wad);
    let (gem) = _gem.read(ilk, usr)
    let (gem) = sub(gem, wad)
    _gem.write(ilk, usr, gem)

    return ()
end

#     function flux(bytes32 ilk, address src, address dst, uint256 wad) external {
func flux{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        ilk: felt, src: felt, dst: felt, wad: Uint256
    ):
    alloc_locals

    # require(wish(src, msg.sender), "Vat/not-allowed");
    let (caller) = get_caller_address()
    let (src_consents) = wish(src, caller)
    assert src_consents = 1

    # gem[ilk][src] = sub(gem[ilk][src], wad);
    let (gem_src) = _gem.read(ilk, src)
    let (gem_src) = sub(gem_src, wad)
    _gem.write(ilk, src, gem_src)

    # gem[ilk][dst] = add(gem[ilk][dst], wad);
    let (gem_dst) = _gem.read(ilk, dst)
    let (gem_dst) = sub(gem_dst, wad)
    _gem.write(ilk, dst, gem_dst)

    return ()
end


#     function move(address src, address dst, uint256 rad) external {
@external
func move{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        src: felt, dst: felt, rad: Uint256
    ):
    alloc_locals

    # require(wish(src, msg.sender), "Vat/not-allowed");
    let (caller) = get_caller_address()
    let (src_consents) = wish(src, caller)
    assert src_consents = 1

    # dai[src] = sub(dai[src], rad);
    let (dai_src) = _dai.read(src)
    let (dai_src) = sub(dai_src, rad)
    _dai.write(src, dai_src)

    # dai[dst] = add(dai[dst], rad);
    let (dai_dst) = _dai.read(dst)
    let (dai_dst) = sub(dai_dst, rad)
    _dai.write(dst, dai_dst)

    return ()
end

#     function either(bool x, bool y) internal pure returns (bool z) {
#   assembly{ z := or(x, y)}
#     }
func assert_either(a: felt, b: felt):
    # TODO: implement
    return ()
end


#     function both(bool x, bool y) internal pure returns (bool z) {
#   assembly{ z := and(x, y)}
#     }
func both(a: felt, b: felt) -> (res: felt):
    # TODO: implement
    return (1)
end

func assert_both(a: felt, b: felt):
    # TODO: implement
    return ()
end


# TODO: how to represent int256?

func not_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func assert_not_0(a: Uint256):
    # TODO: implement
    return ()
end

func ge(a: Uint256, b: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end


func gt_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func ge_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func le(a: Uint256, b: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func assert_le(a: Uint256, b: Uint256) -> ():
    # TODO: implement
    return ()
end

func le_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func eq_0(a: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

# unsigned wad + signed wad -> unsigned wad
func add{range_check_ptr}(a: Uint256, b: Uint256) -> (res: Uint256):
    let (res, carry) = uint256_add(a, b)
    assert carry = 0
    return (res)
end

func sub{range_check_ptr}(a: Uint256, b: Uint256) -> (res: Uint256):
    # TODO: implement
    let (res) = uint256_sub(a, b)
    return (res)
end


func mul{range_check_ptr}(a: Uint256, b: Uint256) -> (res: Uint256):
    assert 0 = 1
    let res = Uint256(0, 0)
    return (res)
end

#     // --- CDP Manipulation ---
#     function frob(bytes32 i, address u, address v, address w, int dink, int dart) external {
@external
func frob{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        i: felt, u: felt, v: felt, w: felt, dink: Uint256, dart: Uint256
    ):
    alloc_locals

    # // system is live
    # require(live == 1, "Vat/not-live");
    with_attr error_message("Vat/not-live"):
        let (live) = _live.read()
        assert live = 1
    end

    # Urn memory urn = urns[i][u];
    # Ilk memory ilk = ilks[i];
    let (urn) = _urns.read(i, u)
    let (local ilk) = _ilks.read(i)

    # // ilk has been initialised
    # require(ilk.rate != 0, "Vat/ilk-not-init");
    assert_not_0(ilk.rate)

    # TODO: signed/unsigned?

    # urn.ink = add(urn.ink, dink);
    # urn.art = add(urn.art, dart);
    # ilk.Art = add(ilk.Art, dart);
    let (ink) = add(urn.ink, dink)
    let (art) = add(urn.art, dart)
    let (Art) = add(ilk.Art, dart)

    # int dtab = mul(ilk.rate, dart);
    # uint tab = mul(ilk.rate, urn.art);
    # debt     = add(debt, dtab);
    let (dtab) = mul(ilk.rate, dart)
    let (tab)  = mul(ilk.rate, art)
    let (debt) = _debt.read()
    let (debt) = add(debt, dtab)

    # // either debt has decreased, or debt ceilings are not exceeded
    # require(either(dart <= 0, both(mul(ilk.Art, ilk.rate) <= ilk.line, debt <= Line)), "Vat/ceiling-exceeded");
    with_attr error_message("Vat/ceiling-exceeded"):
        let (debt_decreased) = le_0(dart)
        let (ilk_debt) = mul(Art, ilk.rate)
        let (line_ok) = le(ilk_debt, ilk.line)
        let (Line_ok) = le(debt, ilk.line)
        let (lines_ok) = both(line_ok, Line_ok)
        assert_either(debt_decreased, lines_ok)
    end

    # // urn is either less risky than before, or it is safe
    # require(either(both(dart <= 0, dink >= 0), tab <= mul(urn.ink, ilk.spot)), "Vat/not-safe");
    with_attr error_message("Vat/not-safe"):
        let (dart_le_0) = le_0(dart)
        let (dink_ge_0) = ge_0(dink)
        let (less_risky) = both(dart_le_0, dink_ge_0)
        let (brim) = mul(urn.ink, ilk.spot)
        let (safe) = le(tab, brim)
        assert_either(less_risky, safe)
    end

    let (caller) = get_caller_address()

    # // urn is either more safe, or the owner consents
    # require(either(both(dart <= 0, dink >= 0), wish(u, msg.sender)), "Vat/not-allowed-u");
    with_attr error_message("Vat/not-allowed-u"):
        let (dart_le_0) = le_0(dart)
        let (dink_ge_0) = ge_0(dink)
        let (less_risky) = both(dart_le_0, dink_ge_0)
        let (owner_consents) = wish(u, caller)
        assert_either(less_risky, owner_consents)
    end

    # // collateral src consents
    # require(either(dink <= 0, wish(v, msg.sender)), "Vat/not-allowed-v");
    with_attr error_message("Vat/not-allowed-v"):
        let (dink_le_0) = le_0(dink)
        let (src_consents) = wish(v, caller)
        assert_either(dink_le_0, src_consents)
    end

    # // debt dst consents
    # require(either(dart >= 0, wish(w, msg.sender)), "Vat/not-allowed-w");
    with_attr error_message("Vat/not-allowed-w"):
        let (dart_ge_0) = ge_0(dart)
        let (dst_consents) = wish(w, caller)
        assert_either(dart_ge_0, dst_consents)
    end

    # // urn has no debt, or a non-dusty amount
    # require(either(urn.art == 0, tab >= ilk.dust), "Vat/dust");
    # TODO: how to manage underwater dusty vaults?
    with_attr error_message("Vat/dust"):
        let (no_debt) = not_0(art)
        let (non_dusty) = ge(tab, ilk.dust)
        assert_either(no_debt, non_dusty)
    end

    # gem[i][v] = sub(gem[i][v], dink);
    let (gem) = _gem.read(i, v)
    let (gem) = add(gem, dink)
    _gem.write(i, v, gem)

    # dai[w]    = add(dai[w],    dtab);
    let (dai) = _dai.read(w)
    let (dai) = add(dai, dtab)
    _dai.write(w, dai)

    # urns[i][u] = urn;
    _urns.write(i, u, Urn(ink, art))

    # ilks[i]    = ilk;
    _ilks.write(i, Ilk(Art = Art, rate = ilk.rate, spot = ilk.spot, line = ilk.line, dust = ilk.dust))

    return ()
end

# // --- CDP Fungibility ---
# function fork(bytes32 ilk, address src, address dst, int dink, int dart) external {
@external
func fork{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        ilk: felt, src: felt, dst: felt, dink: Uint256, dart: Uint256
    ):

    # Urn storage u = urns[ilk][src];
    # Urn storage v = urns[ilk][dst];
    # Ilk storage i = ilks[ilk];
    let (u) = _urns.read(ilk, src)
    let (v) = _urns.read(ilk, dst)
    let (i) = _ilks.read(ilk)

    # u.ink = sub(u.ink, dink);
    # u.art = sub(u.art, dart);
    # v.ink = add(v.ink, dink);
    # v.art = add(v.art, dart);
    let (u_ink) = sub(u.ink, dink)
    let (u_art) = sub(u.art, dart)
    let (v_ink) = add(v.ink, dink)
    let (v_art) = add(v.art, dart)

    _urns.write(ilk, src, Urn(ink=u_ink, art=u_art))
    _urns.write(ilk, dst, Urn(ink=v_ink, art=v_art))

    # uint utab = mul(u.art, i.rate);
    # uint vtab = mul(v.art, i.rate);
    let (u_tab) = mul(u_art, i.rate)
    let (v_tab) = mul(v_art, i.rate)

    let (caller) = get_caller_address()

    # // both sides consent
    # require(both(wish(src, msg.sender), wish(dst, msg.sender)), "Vat/not-allowed");
    with_attr error_message("Vat/not-allowed"):
      let (src_consents) = wish(src, caller)
      let (dst_consents) = wish(src, caller)
      assert_both(src_consents, dst_consents)
    end

    # // both sides safe
    # require(utab <= mul(u.ink, i.spot), "Vat/not-safe-src");
    with_attr error_message("Vat/not-safe-src"):
        let (brim) = mul(u_ink, i.spot)
        assert_le(u_tab, brim)
    end
    # require(vtab <= mul(v.ink, i.spot), "Vat/not-safe-dst");
    with_attr error_message("Vat/not-safe-dst"):
        let (brim) = mul(v_ink, i.spot)
        assert_le(v_tab, brim)
    end

    # // both sides non-dusty
    # require(either(utab >= i.dust, u.art == 0), "Vat/dust-src");
    with_attr error_message("Vat/dust-src"):
        let (u_tab_le_i_dust) = le(u_tab, i.dust)
        let (u_art_eq_0) = eq_0(u_art)
        assert_either(u_tab_le_i_dust, u_art_eq_0)
    end

    # require(either(vtab >= i.dust, v.art == 0), "Vat/dust-dst");
    with_attr error_message("Vat/dust-dst"):
        let (v_tab_le_i_dust) = le(v_tab, i.dust)
        let (v_art_eq_0) = eq_0(v_art)
        assert_either(v_tab_le_i_dust, v_art_eq_0)
    end

    return ()
end


# // --- CDP Confiscation ---
# function grab(bytes32 i, address u, address v, address w, int dink, int dart) external auth {
@external
func grab{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(
        i: felt, u: felt, v: felt, w: felt, dink: Uint256, dart: Uint256
    ):

    auth()

    # Urn storage urn = urns[i][u];
    # Ilk storage ilk = ilks[i];
    let (urn) = _urns.read(i, u)
    let (ilk) = _ilks.read(i)

    # urn.ink = add(urn.ink, dink);
    # urn.art = add(urn.art, dart);
    let (ink) = add(urn.ink, dink)
    let (art) = add(urn.art, dart)
    let urn = Urn(ink = ink, art = art)
    _urns.write(i, u, urn)

    # ilk.Art = add(ilk.Art, dart);
    let (Art) = add(ilk.Art, dart)
    _ilks.write(i, Ilk(Art = Art, rate = ilk.rate, spot = ilk.spot, line = ilk.line, dust = ilk.dust))

    # int dtab = mul(ilk.rate, dart);
    let (dtab) = mul(ilk.rate, dart)

    # gem[i][v] = sub(gem[i][v], dink);
    let (gem) = _gem.read(i, v)
    let (gem) = add(gem, dink)
    _gem.write(i, v, gem)

    # sin[w]    = sub(sin[w],    dtab);
    let (sin) = _sin.read(w)
    let (sin) = sub(sin, dtab)
    _sin.write(w, sin)

    # vice      = sub(vice,      dtab);
    let (vice) = _vice.read()
    let (vice) = sub(vice, dtab)
    _vice.write(vice)

    return ()
end


# // --- Settlement ---
# function heal(uint rad) external {
@external
func heal{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        rad: Uint256
    ):

    # address u = msg.sender;
    let(u) = get_caller_address()

    # sin[u] = sub(sin[u], rad);
    let (sin) = _sin.read(u)
    let (sin) = sub(sin, rad)
    _sin.write(u, sin)

    # dai[u] = sub(dai[u], rad);
    let (dai) = _dai.read(u)
    let (dai) = sub(dai, rad)
    _dai.write(u, dai)

    # vice   = sub(vice,   rad);
    let (vice) = _vice.read()
    let (vice) = sub(vice, rad)
    _vice.write(vice)

    # debt   = sub(debt,   rad);
    let (debt) = _debt.read()
    let (debt) = sub(debt, rad)
    _debt.write(debt)

    return ()
end

# function suck(address u, address v, uint rad) external auth {
@external
func suck{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        u: felt, v: felt, rad: Uint256
    ):

    auth()

    # sin[u] = add(sin[u], rad);
    let (sin) = _sin.read(u)
    let (sin) = sub(sin, rad)
    _sin.write(u, sin)

    # dai[v] = add(dai[v], rad);
    let (dai) = _dai.read(v)
    let (dai) = sub(dai, rad)
    _dai.write(v, dai)

    # vice   = add(vice,   rad);
    let (vice) = _vice.read()
    let (vice) = sub(vice, rad)
    _vice.write(vice)

    # debt   = add(debt,   rad);
    let (debt) = _debt.read()
    let (debt) = sub(debt, rad)
    _debt.write(debt)

    return ()
end


# // --- Rates ---
# function fold(bytes32 i, address u, int rate) external auth {
@external
func fold{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr
    }(
        i: felt, u: felt, rate: Uint256
    ):

    auth()

    # require(live == 1, "Vat/not-live");
    with_attr error_message("Vat/not-live"):
        let (live) = _live.read()
        assert live = 1
    end

    # Ilk storage ilk = ilks[i];
    let (ilk) = _ilks.read(i)

    # ilk.rate = add(ilk.rate, rate);
    let (ilk_rate) = add(ilk.rate, rate)

    _ilks.write(i, Ilk(Art = ilk.Art, rate = ilk_rate, spot = ilk.spot, line = ilk.line, dust = ilk.dust))

    # int rad  = mul(ilk.Art, rate);
    let (rad) = mul(ilk.Art, rate)

    # dai[u]   = add(dai[u], rad);
    let (dai) = _dai.read(u)
    let (dai) = sub(dai, rad)
    _dai.write(u, dai)

    # debt     = add(debt,   rad);
    let (debt) = _debt.read()
    let (debt) = sub(debt, rad)
    _debt.write(debt)

    return ()
end