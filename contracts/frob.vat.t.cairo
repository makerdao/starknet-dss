%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from test import (
  assertTrue,
  assertEq,
  assertEqUint256
)
from starkware.starknet.common.syscalls import (get_contract_address)
from starkware.cairo.common.uint256 import (
  Uint256,
  split_64,
)

@contract_interface
namespace IVat:
  func init(ilk: felt):
  end
  func rely(address: felt):
  end
  func gem(i: felt, u: felt) -> (res : Uint256):
  end
  func frob(i: felt, u: felt, v: felt, w: felt, dink: Uint256, dart: Uint256):
  end
  func fileIlk(ilk: felt, what: felt, data: felt):
  end
  func file(what: felt, data: felt):
  end
  func ink(u: felt, a: felt) -> (res : felt):
  end
end

@contract_interface
namespace IMockToken:
  func mint(amount: felt):
  end

  func approve(amount: felt):
  end

  func balanceOf(user: felt) -> (res : Uint256):
  end
end

@contract_interface
namespace IGemJoin:
  func join(user: felt, wad: Uint256):
  end
  func exit(user: felt, wad: Uint256):
  end
end

# contract FrobTest is DSTest {
#     TestVat   vat;
#     MockToken gold;
#     Jug       jug;
# 
#     GemJoin gemA;
#     address me;
@storage_var
func _vat() -> (res : felt):
end
@storage_var
func _gold() -> (res : felt):
end
@storage_var
func _jug() -> (res : felt):
end

@storage_var
func _gemA() -> (res : felt):
end
@storage_var
func _me() -> (res : felt):
end


const ether = 10 ** 18

#     function try_frob(bytes32 ilk, int256 ink_, int256 art_) public returns (bool ok) {
#         string memory sig = "frob(bytes32,address,address,address,int256,int256)";
#         address self = address(this);
#         (ok,) = address(vat).call(abi.encodeWithSignature(sig, ilk, self, self, self, ink_, art_));
#     }
@external
func try_frob{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk : felt, ink_ : Uint256, art_ : Uint256) -> (res : felt):
    let (vat) = _vat.read()
    let (contract_address) = get_contract_address()
    IVat.frob(vat, ilk, contract_address, contract_address, contract_address, ink_, art_)
    return (1)
end


#     function ray(uint256 wad) internal pure returns (uint) {
#         return wad * 10 ** 9;
#     }
func ray{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(wad : felt) -> (res : felt):
    return (wad * 10 ** 9)
end


#     function setUp() public {
#         vat = new TestVat();
# 
#         gold = new MockToken("GEM");
#         gold.mint(1000 ether);
# 
#         vat.init("gold");
#         gemA = new GemJoin(address(vat), "gold", address(gold));
# 
#         vat.file("gold", "spot",    ray(1 ether));
#         vat.file("gold", "line", rad(1000 ether));
#         vat.file("Line",         rad(1000 ether));
#         jug = new Jug(address(vat));
#         jug.init("gold");
#         vat.rely(address(jug));
# 
#         gold.approve(address(gemA));
#         gold.approve(address(vat));
# 
#         vat.rely(address(vat));
#         vat.rely(address(gemA));
# 
#         gemA.join(address(this), 1000 ether);
# 
#         me = address(this);
#     }
@external
func setUp{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(vat : felt, gold : felt, gemA : felt):
    _vat.write(vat)
    _gold.write(gold)
    _gemA.write(gemA)

    IMockToken.mint(gold, 1000*ether)

    IVat.init(vat, 'gold')

    let (val) = ray(1*ether)
    IVat.fileIlk(vat, 'gold', 'spot', val)
    let (val) = ray(1000*ether)
    IVat.fileIlk(vat, 'gold', 'line', val)
    let (val) = rad(1000*ether)
    IVat.file(vat, 'Line', val)

    # let jug =
    # jug.init('gold')
    # IVat.rely(vat, jug)

    IMockToken.approve(gold, gemA)
    IMockToken.approve(gold, vat)

    IVat.rely(vat, vat)
    IVat.rely(vat, gemA)

    let (contract_address) = get_contract_address()
    let (low, high) = split_64(1000*ether)
    let wad = Uint256(low=low, high=high)
    IGemJoin.join(gemA, contract_address, wad)

    _me.write(contract_address)

    return ()
end


#     function gem(bytes32 ilk, address urn) internal view returns (uint) {
#         return vat.gem(ilk, urn);
#     }
func gem{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk : felt, urn : felt) -> (res : Uint256):
    let (vat) = _vat.read()
    let (res) = IVat.gem(vat, ilk, urn)
    return (res)
end


#     function test_setup() public {
#         assertEq(gold.balanceOf(address(gemA)), 1000 ether);
#         assertEq(gem('gold',    address(this)), 1000 ether);
#     }
@external
func test_setup{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals
    let (gemA) = _gemA.read()
    let (gold) = _gold.read()
    let (balance) = IMockToken.balanceOf(gold, gemA)
    let (local contract_address) = get_contract_address()
    assertEqUint256(balance, Uint256(low=1000*ether, high=0))
    let (res) = gem('gold', contract_address)
    assertEqUint256(res, Uint256(low=1000*ether, high=0))
    return ()
end
#     function test_join() public {
#         address urn = address(this);
#         gold.mint(500 ether);
#         assertEq(gold.balanceOf(address(ths)),     500 ether);
#         assertEq(gold.balanceOf(address(gemA)),   1000 ether);
#         gemA.join(urn,                             500 ether);
#         assertEq(gold.balanceOf(address(this)),      0 ether);
#         assertEq(gold.balanceOf(address(gemA)),   1500 ether);
#         gemA.exit(urn,                             250 ether);
#         assertEq(gold.balanceOf(address(this)),    250 ether);
#         assertEq(gold.balanceOf(address(gemA)),   1250 ether);
#     }
@external
func test_join{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    let (urn) = get_contract_address()
    let (gemA) = _gemA.read()
    let (local gold) = _gold.read()
    IMockToken.mint(gold, 500*ether)
    let (thisBalance) = IMockToken.balanceOf(gold, urn)

    assertEqUint256(thisBalance,    Uint256(low=500*ether, high=0))
    let (gemABalance) = IMockToken.balanceOf(gold, gemA)
    assertEqUint256(gemABalance,   Uint256(low=1000*ether, high=0))

    IGemJoin.join(gemA, urn, Uint256(low=1000*ether, high=0))
    let (thisBalance) = IMockToken.balanceOf(gold, urn)
    assertEqUint256(thisBalance,     Uint256(low=50*ether, high=0))
    let (gemABalance) = IMockToken.balanceOf(gold, gemA)
    assertEqUint256(gemABalance,   Uint256(low=1500*ether, high=0))

    IGemJoin.exit(gemA, urn, Uint256(low=250*ether, high=0))
    let (thisBalance) = IMockToken.balanceOf(gold, urn)
    assertEqUint256(thisBalance,    Uint256(low=250*ether, high=0))
    let (gemABalance) = IMockToken.balanceOf(gold, gemA)
    assertEqUint256(gemABalance,   Uint256(low=1250*ether, high=0))

    return ()
end
#     function test_lock() public {
#         assertEq(vat.ink("gold", address(this)),    0 ether);
#         assertEq(gem("gold", address(this)), 1000 ether);
#         vat.frob("gold", me, me, me, 6 ether, 0);
#         assertEq(vat.ink("gold", address(this)),   6 ether);
#         assertEq(gem("gold", address(this)), 994 ether);
#         vat.frob("gold", me, me, me, -6 ether, 0);
#         assertEq(vat.ink("gold", address(this)),    0 ether);
#         assertEq(gem("gold", address(this)), 1000 ether);
#     }
@external
func test_lock{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    let (local contract_address) = get_contract_address()
    let (vat) = _vat.read()
    let (me) = _me.read()

    let (ink_res) = IVat.ink(vat, 'gold', contract_address)
    assertEq(ink_res,    0*ether)
    let (gem_res) = gem('gold', contract_address)
    assertEqUint256(gem_res, Uint256(low=1000*ether, high=0))

    IVat.frob(vat, 'gold', me, me, me, Uint256(low=6*ether, high=0), Uint256(low=0, high=0))
    let (ink_res) = IVat.ink(vat, 'gold', contract_address)
    assertEq(ink_res, 6*ether)
    let (gem_res) = gem('gold', contract_address)
    assertEqUint256(gem_res, Uint256(low=994*ether, high=0))

    # IVat.frob(vat, 'gold', me, me, me, -6*ether, 0) # TODO
    let (ink_res) = IVat.ink(vat, 'gold', contract_address)
    assertEq(ink_res, 0*ether)
    let (gem_res) = gem('gold', contract_address)
    assertEqUint256(gem_res, Uint256(low=1000*ether, high=0))

    return ()
end
#     function test_calm() public {
#         // calm means that the debt ceiling is not exceeded
#         // it's ok to increase debt as long as you remain calm
#         vat.file("gold", 'line', rad(10 ether));
#         assertTrue( try_frob("gold", 10 ether, 9 ether));
#         // only if under debt ceiling
#         assertTrue(!try_frob("gold",  0 ether, 2 ether));
#     }
@external
func test_calm{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    let (val) = rad(10*ether)
    let (vat) = _vat.read()
    IVat.fileIlk(vat, 'gold', 'line', val)
    let (res) = try_frob('gold', Uint256(low=10*ether, high=0), Uint256(low=9*ether, high=0))
    assertTrue(res)
    let (res) = try_frob('gold', Uint256(low=0, high=0), Uint256(low=2*ether, high=0))
    assertTrue(res)

    return ()
end
#     function test_cool() public {
#         // cool means that the debt has decreased
#         // it's ok to be over the debt ceiling as long as you're cool
#         vat.file("gold", 'line', rad(10 ether));
#         assertTrue(try_frob("gold", 10 ether,  8 ether));
#         vat.file("gold", 'line', rad(5 ether));
#         // can decrease debt when over ceiling
#         assertTrue(try_frob("gold",  0 ether, -1 ether));
#     }
@external
func test_cool{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    let (local vat) = _vat.read()

    let (val) = rad(10*ether)
    IVat.fileIlk(vat, 'gold', 'line', val)
    let (res) = try_frob('gold', Uint256(low=10*ether, high=0), Uint256(low=8*ether, high=0))
    assertTrue(res)

    let (val) = rad(5*ether)
    IVat.fileIlk(vat, 'gold', 'line', val)
    # let (res) = try_frob('gold', Uint256(low=0, high=0), -1*ether) # TODO
    assertTrue(res)

    return ()
end
#     function test_safe() public {
#         // safe means that the cdp is not risky
#         // you can't frob a cdp into unsafe
#         vat.frob("gold", me, me, me, 10 ether, 5 ether);                // safe draw
#         assertTrue(!try_frob("gold", 0 ether, 6 ether));  // unsafe draw
#     }
@external
func test_safe{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    let (me) = _me.read()
    let (vat) = _vat.read()
    IVat.frob(vat, 'gold', me, me, me, Uint256(low=10*ether, high=0), Uint256(low=5*ether, high=0))
    let (res) = try_frob('gold', Uint256(low=0, high=0), Uint256(low=6*ether, high=0))
    assertTrue(1 - res)

    return ()
end
#     function test_nice() public {
#         // nice means that the collateral has increased or the debt has
#         // decreased. remaining unsafe is ok as long as you're nice
# 
#         vat.frob("gold", me, me, me, 10 ether, 10 ether);
#         vat.file("gold", 'spot', ray(0.5 ether));  // now unsafe
# 
#         // debt can't increase if unsafe
#         assertTrue(!try_frob("gold",  0 ether,  1 ether));
#         // debt can decrease
#         assertTrue( try_frob("gold",  0 ether, -1 ether));
#         // ink can't decrease
#         assertTrue(!try_frob("gold", -1 ether,  0 ether));
#         // ink can increase
#         assertTrue( try_frob("gold",  1 ether,  0 ether));
# 
#         // cdp is still unsafe
#         // ink can't decrease, even if debt decreases more
#         assertTrue(!this.try_frob("gold", -2 ether, -4 ether));
#         // debt can't increase, even if ink increases more
#         assertTrue(!this.try_frob("gold",  5 ether,  1 ether));
# 
#         // ink can decrease if end state is safe
#         assertTrue( this.try_frob("gold", -1 ether, -4 ether));
#         vat.file("gold", 'spot', ray(0.4 ether));  // now unsafe
#         // debt can increase if end state is safe
#         assertTrue( this.try_frob("gold",  5 ether, 1 ether));
#     }
@external
func test_nice{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    # nice means that the collateral has increased or the debt has
    # decreased. remaining unsafe is ok as long as you're nice

    let (local vat) = _vat.read()
    let (me) = _me.read()

    IVat.frob(vat, 'gold', me, me, me, Uint256(low=10*ether, high=0), Uint256(low=10*ether, high=0))
    let (val) = ray((5*ether)/10)
    IVat.fileIlk(vat, 'gold', 'spot', val) # now unsafe

    # debt can't increase if unsafe
    let (res) = try_frob('gold', Uint256(low=0, high=0), Uint256(low=1*ether, high=0))
    assertTrue(1-res)
    # debt can decrease
    # let (res) = try_frob('gold', Uint256(low=0, high=0), Uint256(low=-1*ether, high=0)) # TODO
    #assertTrue(res)
    # ink can't decrease
    #let (res) = try_frob('gold', -1*ether, Uint256(low=0, high=0)) # TODO
    #assertTrue(1-res)
    # ink can increase
    let (res) = try_frob('gold', Uint256(low=1*ether, high=0), Uint256(low=0, high=0))
    assertTrue(res)

    # cdp is still unsafe
    # ink can't decrease, even if debt decreases more
    #let (res) = try_frob('gold', -2*ether, -4*ether) # TODO
    #assertTrue(1-res)
    # debt can't increase, even if ink increases more
    let (res) = try_frob('gold', Uint256(low=5*ether, high=0), Uint256(low=1*ether, high=0))
    assertTrue(1-res)

    # ink can decrease if end state is safe
    # let (res) = try_frob('gold', -1*ether, -4*ether) # TODO
    #assertTrue(res)
    let (val) = ray((4*ether)/10)
    IVat.fileIlk(vat, 'gold', 'spot', val)
    # debt can increase if end state is safe
    let (res) = try_frob('gold', Uint256(low=5*ether, high=0), Uint256(low=1*ether, high=0))
    assertTrue(res)

    return ()
end
# 
#     function rad(uint256 wad) internal pure returns (uint) {
#         return wad * 10 ** 27;
#     }
func rad{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(wad : felt) -> (res : felt):
    return (wad * 10 ** 27)
end
#     function test_alt_callers() public {
#         Usr ali = new Usr(vat);
#         Usr bob = new Usr(vat);
#         Usr che = new Usr(vat);
# 
#         address a = address(ali);
#         address b = address(bob);
#         address c = address(che);
# 
#         vat.slip("gold", a, int256(rad(20 ether)));
#         vat.slip("gold", b, int256(rad(20 ether)));
#         vat.slip("gold", c, int256(rad(20 ether)));
# 
#         ali.frob("gold", a, a, a, 10 ether, 5 ether);
# 
#         // anyone can lock
#         assertTrue( ali.can_frob("gold", a, a, a,  1 ether,  0 ether));
#         assertTrue( bob.can_frob("gold", a, b, b,  1 ether,  0 ether));
#         assertTrue( che.can_frob("gold", a, c, c,  1 ether,  0 ether));
#         // but only with their own gems
#         assertTrue(!ali.can_frob("gold", a, b, a,  1 ether,  0 ether));
#         assertTrue(!bob.can_frob("gold", a, c, b,  1 ether,  0 ether));
#         assertTrue(!che.can_frob("gold", a, a, c,  1 ether,  0 ether));
# 
#         // only the lad can free
#         assertTrue( ali.can_frob("gold", a, a, a, -1 ether,  0 ether));
#         assertTrue(!bob.can_frob("gold", a, b, b, -1 ether,  0 ether));
#         assertTrue(!che.can_frob("gold", a, c, c, -1 ether,  0 ether));
#         // the lad can free to anywhere
#         assertTrue( ali.can_frob("gold", a, b, a, -1 ether,  0 ether));
#         assertTrue( ali.can_frob("gold", a, c, a, -1 ether,  0 ether));
# 
#         // only the lad can draw
#         assertTrue( ali.can_frob("gold", a, a, a,  0 ether,  1 ether));
#         assertTrue(!bob.can_frob("gold", a, b, b,  0 ether,  1 ether));
#         assertTrue(!che.can_frob("gold", a, c, c,  0 ether,  1 ether));
#         // the lad can draw to anywhere
#         assertTrue( ali.can_frob("gold", a, a, b,  0 ether,  1 ether));
#         assertTrue( ali.can_frob("gold", a, a, c,  0 ether,  1 ether));
# 
#         vat.mint(address(bob), 1 ether);
#         vat.mint(address(che), 1 ether);
# 
#         // anyone can wipe
#         assertTrue( ali.can_frob("gold", a, a, a,  0 ether, -1 ether));
#         assertTrue( bob.can_frob("gold", a, b, b,  0 ether, -1 ether));
#         assertTrue( che.can_frob("gold", a, c, c,  0 ether, -1 ether));
#         // but only with their own dai
#         assertTrue(!ali.can_frob("gold", a, a, b,  0 ether, -1 ether));
#         assertTrue(!bob.can_frob("gold", a, b, c,  0 ether, -1 ether));
#         assertTrue(!che.can_frob("gold", a, c, a,  0 ether, -1 ether));
#     }

# 
#     function test_hope() public {
#         Usr ali = new Usr(vat);
#         Usr bob = new Usr(vat);
#         Usr che = new Usr(vat);
# 
#         address a = address(ali);
#         address b = address(bob);
#         address c = address(che);
# 
#         vat.slip("gold", a, int256(rad(20 ether)));
#         vat.slip("gold", b, int256(rad(20 ether)));
#         vat.slip("gold", c, int256(rad(20 ether)));
# 
#         ali.frob("gold", a, a, a, 10 ether, 5 ether);
# 
#         // only owner can do risky actions
#         assertTrue( ali.can_frob("gold", a, a, a,  0 ether,  1 ether));
#         assertTrue(!bob.can_frob("gold", a, b, b,  0 ether,  1 ether));
#         assertTrue(!che.can_frob("gold", a, c, c,  0 ether,  1 ether));
# 
#         ali.hope(address(bob));
# 
#         // unless they hope another user
#         assertTrue( ali.can_frob("gold", a, a, a,  0 ether,  1 ether));
#         assertTrue( bob.can_frob("gold", a, b, b,  0 ether,  1 ether));
#         assertTrue(!che.can_frob("gold", a, c, c,  0 ether,  1 ether));
#     }
# @external
# func test_hope():
#     let ali # TODO
#     let bob # TODO
#     let che # TODO
# 
#     let (vat) = _vat.read()
#     IVat.slip(vat, "gold", ali, 
#     IVat.slip(vat, "gold", bob, 
#     IVat.slip(vat, "gold", che, 
# 
#     IUsr(ali).frob("gold", ali, ali, ali, 10*ether, 5*ether)
# 
#     # only owner can do risky actions
#     let (res) = IUsr(ali).can_frob("gold", ali, ali, ali, 0*ether, 1*ether)
#     assertTrue(res)
#     let (res) = IUsr(bob).can_frob("gold", ali, bob, bob, 0*ether, 1*ether)
#     assertTrue(1 - res)
#     let (res) = IUsr(che).can_frob("gold", ali, che, che, 0*ether, 1*ether)
#     assertTrue(1 - res)
# 
#     IUsr(ali).hope(bob)
# 
#     # unless they hope another user
#     let (res) = IUsr(ali).can_frob("gold", ali, ali, ali, 0*ether, 1*ether)
#     assertTrue(res)
#     let (res) = IUsr(bob).can_frob("gold", ali, bob, bob, 0*ether, 1*ether)
#     assertTrue(res)
#     let (res) = IUsr(che).can_frob("gold", ali, che, che, 0*ether, 1*ether)
#     assertTrue(1 - res)
# 
#     return ()
# end
# 
#     function test_dust() public {
#         assertTrue( try_frob("gold", 9 ether,  1 ether));
#         vat.file("gold", "dust", rad(5 ether));
#         assertTrue(!try_frob("gold", 5 ether,  2 ether));
#         assertTrue( try_frob("gold", 0 ether,  5 ether));
#         assertTrue(!try_frob("gold", 0 ether, -5 ether));
#         assertTrue( try_frob("gold", 0 ether, -6 ether));
#     }
@external
func test_dust{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    let (res) = try_frob('gold', Uint256(low=9*ether, high=0), Uint256(low=1*ether, high=0))
    let (vat) = _vat.read()
    let (val) = rad(5*ether)
    IVat.fileIlk(vat, 'gold', 'dust', val)
    let (res) = try_frob('gold', Uint256(low=5*ether, high=0), Uint256(low=2*ether, high=0))
    assertTrue(1 - res)
    let (res) = try_frob('gold', Uint256(low=0, high=0), Uint256(low=5*ether, high=0))
    assertTrue(res)
    # let (res) = try_frob('gold', Uint256(low=0, high=0), -5*ether) # TODO
    # assertTrue(1 - res)
    # let (res) = try_frob('gold', 0*ether, -6*ether) # TODO
    # assertTrue(res)

    return ()
end
# }
