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
# contract Vat {
#     // --- Auth ---
#     mapping (address => uint) public wards;
#     function rely(address usr) external auth { require(live == 1, "Vat/not-live"); wards[usr] = 1; }
#     function deny(address usr) external auth { require(live == 1, "Vat/not-live"); wards[usr] = 0; }
#     modifier auth {
#         require(wards[msg.sender] == 1, "Vat/not-authorized");
#         _;
#     }

#     mapping(address => mapping (address => uint)) public can;
@storage_var
func _can(u: felt) -> (res : felt):
end

#     function hope(address usr) external { can[msg.sender][usr] = 1; }
#     function nope(address usr) external { can[msg.sender][usr] = 0; }
#     function wish(address bit, address usr) internal view returns (bool) {
#         return either(bit == usr, can[bit][usr] == 1);
#     }

#     struct Ilk {
#         uint256 Art;   // Total Normalised Debt     [wad]
#         uint256 rate;  // Accumulated Rates         [ray]
#         uint256 spot;  // Price with Safety Margin  [ray]
#         uint256 line;  // Debt Ceiling              [rad]
#         uint256 dust;  // Urn Debt Floor            [rad]
#     }
struct Ilk:
    member Art: Uint256   # Total Normalised Debt     [wad]
    member rate: Uint256  # Accumulated Rates         [ray]
    member spot: Uint256  # Price with Safety Margin  [ray]
    member line: Uint256  # Debt Ceiling              [rad]
    member dust: Uint256  # Urn Debt Floor            [rad]
end

#     struct Urn {
#         uint256 ink;   // Locked Collateral  [wad]
#         uint256 art;   // Normalised Debt    [wad]
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
#         wards[msg.sender] = 1;
#         live = 1;
#     }

#     // --- Math ---
#     function add(uint x, int y) internal pure returns (uint z) {
#         z = x + uint(y);
#         require(y >= 0 || z <= x);
#         require(y <= 0 || z >= x);
#     }
#     function sub(uint x, int y) internal pure returns (uint z) {
#         z = x - uint(y);
#         require(y <= 0 || z <= x);
#         require(y >= 0 || z >= x);
#     }
#     function mul(uint x, int y) internal pure returns (int z) {
#         z = int(x) * y;
#         require(int(x) >= 0);
#         require(y == 0 || z / y == int(x));
#     }
#     function add(uint x, uint y) internal pure returns (uint z) {
#         require((z = x + y) >= x);
#     }
#     function sub(uint x, uint y) internal pure returns (uint z) {
#         require((z = x - y) <= x);
#     }
#     function mul(uint x, uint y) internal pure returns (uint z) {
#         require(y == 0 || (z = x * y) / y == x);
#     }

#     // --- Administration ---
#     function init(bytes32 ilk) external auth {
#         require(ilks[ilk].rate == 0, "Vat/ilk-already-init");
#         ilks[ilk].rate = 10 ** 27;
#     }
#     function file(bytes32 what, uint data) external auth {
#         require(live == 1, "Vat/not-live");
#         if (what == "Line") Line = data;
#         else revert("Vat/file-unrecognized-param");
#     }
#     function file(bytes32 ilk, bytes32 what, uint data) external auth {
#         require(live == 1, "Vat/not-live");
#         if (what == "spot") ilks[ilk].spot = data;
#         else if (what == "line") ilks[ilk].line = data;
#         else if (what == "dust") ilks[ilk].dust = data;
#         else revert("Vat/file-unrecognized-param");
#     }
#     function cage() external auth {
#         live = 0;
#     }

#     // --- Fungibility ---
#     function slip(bytes32 ilk, address usr, int256 wad) external auth {
#         gem[ilk][usr] = add(gem[ilk][usr], wad);
#     }
#     function flux(bytes32 ilk, address src, address dst, uint256 wad) external {
#         require(wish(src, msg.sender), "Vat/not-allowed");
#         gem[ilk][src] = sub(gem[ilk][src], wad);
#         gem[ilk][dst] = add(gem[ilk][dst], wad);
#     }
#     function move(address src, address dst, uint256 rad) external {
#         require(wish(src, msg.sender), "Vat/not-allowed");
#         dai[src] = sub(dai[src], rad);
#         dai[dst] = add(dai[dst], rad);
#     }

#     function either(bool x, bool y) internal pure returns (bool z) {
#         assembly{ z := or(x, y)}
#     }
#     function both(bool x, bool y) internal pure returns (bool z) {
#         assembly{ z := and(x, y)}
#     }


# TODO: how to represent int256?

func not_zero(x: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func gt_zero(x: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func le(a: Uint256, b: Uint256) -> (res: felt):
    # TODO: implement
    return (1)
end

func assert_le(a: Uint256, b: Uint256):
    # TODO: implement
    return ()
end


# unsigned wad + signed wad -> unsigned wad
func add{range_check_ptr}(a: Uint256, b: Uint256) -> (res: Uint256):
    let (res, carry) = uint256_add(a, b)
    assert carry = 0
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
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(i: felt, u: felt, v: felt, w: felt, dink: Uint256, dart: Uint256) -> ():
    alloc_locals

#         // system is live
#         require(live == 1, "Vat/not-live");
    let (live) = _live.read()
    assert live = 1


#         Urn memory urn = urns[i][u];
#         Ilk memory ilk = ilks[i];
    let (urn) = _urns.read(i, u)
    let (local ilk) = _ilks.read(i)

#         // ilk has been initialised
#         require(ilk.rate != 0, "Vat/ilk-not-init");
    not_zero(ilk.rate)

    # TODO: signed/unsigned?

#         urn.ink = add(urn.ink, dink);
#         urn.art = add(urn.art, dart);
#         ilk.Art = add(ilk.Art, dart);
    let (ink) = add(urn.ink, dink)
    let (art) = add(urn.art, dart)
    let (Art) = add(ilk.Art, dart)

#         int dtab = mul(ilk.rate, dart);
#         uint tab = mul(ilk.rate, urn.art);
#         debt     = add(debt, dtab);
    let (debt) = _debt.read()
    let (dtab) = mul(ilk.rate, dart)
    let (tab)  = mul(ilk.rate, art)
    let (debt) = add(debt, dtab)

#         // either debt has decreased, or debt ceilings are not exceeded
#         require(either(dart <= 0, both(mul(ilk.Art, ilk.rate) <= ilk.line, debt <= Line)), "Vat/ceiling-exceeded");
    let (debt_increased) = gt_zero(dart)
    with_attr error_message("Vat/ceiling-exceeded"):

        if debt_increased == 1:
            let (ilk_debt) = mul(Art, ilk.rate)
            assert_le(ilk_debt, ilk.line)

            let (Line) = _Line.read()
            assert_le(debt, Line)

            tempvar syscall_ptr = syscall_ptr
            tempvar pedersen_ptr = pedersen_ptr
            tempvar range_check_ptr = range_check_ptr
        else:
            tempvar syscall_ptr = syscall_ptr
            tempvar pedersen_ptr = pedersen_ptr
            tempvar range_check_ptr = range_check_ptr
        end
    end


    # let ink_decreased = lt_zero(dink)
    # if either(debt_increased, ink_decreased)
#         // urn is either less risky than before, or it is safe
#         require(either(both(dart <= 0, dink >= 0), tab <= mul(urn.ink, ilk.spot)), "Vat/not-safe");

#         // urn is either more safe, or the owner consents
#         require(either(both(dart <= 0, dink >= 0), wish(u, msg.sender)), "Vat/not-allowed-u");
#         // collateral src consents
#         require(either(dink <= 0, wish(v, msg.sender)), "Vat/not-allowed-v");
#         // debt dst consents
#         require(either(dart >= 0, wish(w, msg.sender)), "Vat/not-allowed-w");

#         // urn has no debt, or a non-dusty amount
#         require(either(urn.art == 0, tab >= ilk.dust), "Vat/dust");

#         gem[i][v] = sub(gem[i][v], dink);
#         dai[w]    = add(dai[w],    dtab);

#         urns[i][u] = urn;
    let urn = Urn(ink, art)
    _urns.write(i, u, urn)

#         ilks[i]    = ilk;
    let ilk = Ilk(Art, rate = ilk.rate, spot = ilk.spot, line = ilk.line, dust = ilk.dust)
    _ilks.write(i, ilk)

    return ()

#     }
end

#     // --- CDP Fungibility ---
#     function fork(bytes32 ilk, address src, address dst, int dink, int dart) external {
#         Urn storage u = urns[ilk][src];
#         Urn storage v = urns[ilk][dst];
#         Ilk storage i = ilks[ilk];

#         u.ink = sub(u.ink, dink);
#         u.art = sub(u.art, dart);
#         v.ink = add(v.ink, dink);
#         v.art = add(v.art, dart);

#         uint utab = mul(u.art, i.rate);
#         uint vtab = mul(v.art, i.rate);

#         // both sides consent
#         require(both(wish(src, msg.sender), wish(dst, msg.sender)), "Vat/not-allowed");

#         // both sides safe
#         require(utab <= mul(u.ink, i.spot), "Vat/not-safe-src");
#         require(vtab <= mul(v.ink, i.spot), "Vat/not-safe-dst");

#         // both sides non-dusty
#         require(either(utab >= i.dust, u.art == 0), "Vat/dust-src");
#         require(either(vtab >= i.dust, v.art == 0), "Vat/dust-dst");
#     }
#     // --- CDP Confiscation ---
#     function grab(bytes32 i, address u, address v, address w, int dink, int dart) external auth {
#         Urn storage urn = urns[i][u];
#         Ilk storage ilk = ilks[i];

#         urn.ink = add(urn.ink, dink);
#         urn.art = add(urn.art, dart);
#         ilk.Art = add(ilk.Art, dart);

#         int dtab = mul(ilk.rate, dart);

#         gem[i][v] = sub(gem[i][v], dink);
#         sin[w]    = sub(sin[w],    dtab);
#         vice      = sub(vice,      dtab);
#     }

#     // --- Settlement ---
#     function heal(uint rad) external {
#         address u = msg.sender;
#         sin[u] = sub(sin[u], rad);
#         dai[u] = sub(dai[u], rad);
#         vice   = sub(vice,   rad);
#         debt   = sub(debt,   rad);
#     }
#     function suck(address u, address v, uint rad) external auth {
#         sin[u] = add(sin[u], rad);
#         dai[v] = add(dai[v], rad);
#         vice   = add(vice,   rad);
#         debt   = add(debt,   rad);
#     }

#     // --- Rates ---
#     function fold(bytes32 i, address u, int rate) external auth {
#         require(live == 1, "Vat/not-live");
#         Ilk storage ilk = ilks[i];
#         ilk.rate = add(ilk.rate, rate);
#         int rad  = mul(ilk.Art, rate);
#         dai[u]   = add(dai[u], rad);
#         debt     = add(debt,   rad);
#     }
# }