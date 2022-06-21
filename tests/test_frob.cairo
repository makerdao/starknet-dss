# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2021 Dai Foundation
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from contracts.test import (
  assertTrue,
  assertEq,
  assertEqUint256
)
from starkware.starknet.common.syscalls import (
  get_contract_address
)
from starkware.cairo.common.math import (
  assert_le
)
from starkware.cairo.common.uint256 import (
  Uint256,
  split_64,
  uint256_mul
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
  func file_ilk(ilk: felt, what: felt, data: Uint256):
  end
  func file(what: felt, data: Uint256):
  end
  func ink(u: felt, a: felt) -> (res : Uint256):
  end
end

@contract_interface
namespace IMockToken:
  func mint(user: felt, amount: Uint256):
  end

  func approve(spender: felt, amount: Uint256):
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

const MAX_HALF = 2**128-1

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

@external
func try_frob{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk: felt, ink_: Uint256, art_: Uint256) -> (res: felt):
    tempvar vat
    %{ ids.vat = context.vat %}

    # string memory sig = "frob(bytes32,address,address,address,int256,int256)";
    # address self = address(this);
    # (ok,) = address(vat).call(abi.encodeWithSignature(sig, ilk, self, self, self, ink_, art_));
    let (contract_address) = get_contract_address()
    IVat.frob(vat, ilk, contract_address, contract_address, contract_address, ink_, art_)
    return (1)
end


func ray{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(wad : Uint256) -> (res : Uint256):
    # return wad * 10 ** 9;
    let ray = Uint256(10**9, 0)
    let (low: Uint256, high: Uint256) = uint256_mul(wad, ray)
    return (low)
end


@view
func __setup__{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    local vat
    local gold
    local gemA

    local GEM = 'GEM'
    local GOLD = 'gold'
    let (local contract_address) = get_contract_address() 
    %{
      context.vat = deploy_contract("./contracts/vat.cairo", [ids.contract_address]).contract_address
      ids.vat = context.vat
      context.gold = deploy_contract("./contracts/mock_token.cairo", [ids.GEM]).contract_address
      ids.gold = context.gold
      context.gemA = deploy_contract("./contracts/gem_join.cairo", [ids.vat, ids.GOLD, ids.gold]).contract_address
      ids.gemA = context.gemA
      context.me = ids.contract_address
    %}

    # vat = new TestVat();
    #
    # gold = new MockToken("GEM");
    # gold.mint(1000 ether);
    #
    # vat.init("gold");
    # gemA = new GemJoin(address(vat), "gold", address(gold));
    #
    #
    # gold.approve(address(gemA));
    # gold.approve(address(vat));
    #
    # vat.rely(address(vat));
    # vat.rely(address(gemA));
    #
    # gemA.join(address(this), 1000 ether);
    #
    # me = address(this);
    IMockToken.mint(gold, contract_address, Uint256(1000*ether, 0))

    IVat.init(vat, 'gold')

    # vat.file("gold", "spot",    ray(1 ether));
    # vat.file("gold", "line", rad(1000 ether));
    # vat.file("Line",         rad(1000 ether));
    let (val: Uint256) = ray(Uint256(1*ether, 0))
    IVat.file_ilk(vat, 'gold', 'spot', val)
    let (val: Uint256) = ray(Uint256(1000*ether, 0))
    IVat.file_ilk(vat, 'gold', 'line', val)
    let (val: Uint256) = rad(Uint256(1000*ether, 0))
    IVat.file(vat, 'Line', val)

    # jug = new Jug(address(vat));
    # jug.init("gold");
    # vat.rely(address(jug));
    #local jug
    #%{ ids.jug = deploy_contract("./contracts/jug.cairo", [ids.vat]).contract_address %}
    #IJug.init(jug, 'gold')
    #IVat.rely(vat, jug)

    IMockToken.approve(gold, gemA, Uint256(MAX_HALF, MAX_HALF))
    IMockToken.approve(gold, vat,  Uint256(MAX_HALF, MAX_HALF))

    IVat.rely(vat, vat)
    IVat.rely(vat, gemA)

    let (contract_address) = get_contract_address()
    IGemJoin.join(gemA, contract_address, Uint256(1000*ether, 0))

    _me.write(contract_address)

    return ()
end


func gem{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(ilk : felt, urn : felt) -> (res : Uint256):
    # return vat.gem(ilk, urn);
    tempvar vat
    %{ ids.vat = context.vat %}
    let (res) = IVat.gem(vat, ilk, urn)
    return (res)
end


@external
func test_setup{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    tempvar gemA
    tempvar gold
    %{
      ids.gemA = context.gemA
      ids.gold = context.gold
    %}
    let (local contract_address) = get_contract_address()

    # assertEq(gold.balanceOf(address(gemA)), 1000 ether);
    let (balance) = IMockToken.balanceOf(gold, gemA)
    assertEqUint256(balance, Uint256(1000*ether, 0))

    # assertEq(gem('gold',    address(this)), 1000 ether);
    let (res) = gem('gold', contract_address)
    assertEqUint256(res, Uint256(1000*ether, 0))

    return ()
end

@external
func test_join{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    local gemA
    local gold
    %{
      ids.gemA = context.gemA
      ids.gold = context.gold
    %}

    # address urn = address(this);
    let (urn) = get_contract_address()

    # gold.mint(500 ether);
    # assertEq(gold.balanceOf(address(ths)),     500 ether);
    # assertEq(gold.balanceOf(address(gemA)),   1000 ether);
    IMockToken.mint(gold, urn,      Uint256(500*ether, 0))
    let (thisBalance) = IMockToken.balanceOf(gold, urn)
    assertEqUint256(thisBalance,    Uint256(500*ether, 0))
    let (gemABalance) = IMockToken.balanceOf(gold, gemA)
    assertEqUint256(gemABalance,   Uint256(1000*ether, 0))

    # gemA.join(urn,                             500 ether);
    # assertEq(gold.balanceOf(address(this)),      0 ether);
    # assertEq(gold.balanceOf(address(gemA)),   1500 ether);
    IGemJoin.join(gemA, urn,         Uint256(500*ether, 0))
    let (thisBalance) = IMockToken.balanceOf(gold, urn)
    assertEqUint256(thisBalance,            Uint256(0, 0))
    let (gemABalance) = IMockToken.balanceOf(gold, gemA)
    assertEqUint256(gemABalance,   Uint256(1500*ether, 0))

    # gemA.exit(urn,                             250 ether);
    # assertEq(gold.balanceOf(address(this)),    250 ether);
    # assertEq(gold.balanceOf(address(gemA)),   1250 ether);
    IGemJoin.exit(gemA, urn,        Uint256(250*ether, 0))
    let (thisBalance) = IMockToken.balanceOf(gold, urn)
    assertEqUint256(thisBalance,    Uint256(250*ether, 0))
    let (gemABalance) = IMockToken.balanceOf(gold, gemA)
    assertEqUint256(gemABalance,   Uint256(1250*ether, 0))

    return ()
end

@external
func test_lock{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    local vat
    local  me
    %{
      ids.vat = context.vat
      ids.me = context.me
    %}
    let (local contract_address) = get_contract_address()

    # assertEq(vat.ink("gold", address(this)),    0 ether);
    # assertEq(gem("gold", address(this)), 1000 ether);
    let (ink_res: Uint256) = IVat.ink(vat, 'gold', contract_address)
    assertEqUint256(ink_res,    Uint256(0, 0))
    let (gem_res) = gem('gold', contract_address)
    assertEqUint256(gem_res, Uint256(1000*ether, 0))

    # vat.frob("gold", me, me, me, 6 ether, 0);
    # assertEq(vat.ink("gold", address(this)),   6 ether);
    # assertEq(gem("gold", address(this)), 994 ether);
    IVat.frob(vat, 'gold', me, me, me, Uint256(6*ether, 0), Uint256(0, 0))
    let (ink_res: Uint256) = IVat.ink(vat, 'gold', contract_address)
    assertEqUint256(ink_res, Uint256(6*ether, 0))
    let (gem_res) = gem('gold', contract_address)
    assertEqUint256(gem_res, Uint256(994*ether, 0))

    # vat.frob("gold", me, me, me, -6 ether, 0);
    # assertEq(vat.ink("gold", address(this)),    0 ether);
    # assertEq(gem("gold", address(this)), 1000 ether);
    # IVat.frob(vat, 'gold', me, me, me, -6*ether, 0) # TODO
    # let (ink_res: Uint256) = IVat.ink(vat, 'gold', contract_address)
    # assertEqUint256(ink_res, Uint256(0, 0))
    # let (gem_res) = gem('gold', contract_address)
    # assertEqUint256(gem_res, Uint256(1000*ether, 0))

    return ()
end

@external
func test_calm{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    local vat
    %{ ids.vat = context.vat %}

    # // calm means that the debt ceiling is not exceeded
    # // it's ok to increase debt as long as you remain calm
    # vat.file("gold", 'line', rad(10 ether));
    let (val) = rad(Uint256(10*ether, 0))
    IVat.file_ilk(vat, 'gold', 'line', val)

    # assertTrue( try_frob("gold", 10 ether, 9 ether));
    let (res) = try_frob('gold', Uint256(10*ether, 0), Uint256(9*ether, 0))
    assertTrue(res)

    # // only if under debt ceiling
    # assertTrue(!try_frob("gold",  0 ether, 2 ether));
    # let (res) = try_frob('gold', Uint256(0, 0), Uint256(2*ether, 0)) # TODO FIX
    # assertTrue(1-res)

    return ()
end

@external
func test_cool{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    local vat
    %{ ids.vat = context.vat %}

    # // cool means that the debt has decreased
    # // it's ok to be over the debt ceiling as long as you're cool

    # vat.file("gold", 'line', rad(10 ether));
    let (val) = rad(Uint256(10*ether, 0))
    IVat.file_ilk(vat, 'gold', 'line', val)

    # assertTrue(try_frob("gold", 10 ether,  8 ether));
    let (res) = try_frob('gold', Uint256(10*ether, 0), Uint256(8*ether, 0))
    assertTrue(res)

    # vat.file("gold", 'line', rad(5 ether));
    # // can decrease debt when over ceiling
    let (val) = rad(Uint256(5*ether, 0))
    IVat.file_ilk(vat, 'gold', 'line', val)

    # assertTrue(try_frob("gold",  0 ether, -1 ether));
    # let (res) = try_frob('gold', Uint256(0, 0), -1*ether) # TODO
    assertTrue(res)

    return ()
end

@external
func test_safe{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    tempvar me
    tempvar vat
    %{
      ids.me = context.me
      ids.vat = context.vat
    %}

    # // safe means that the cdp is not risky
    # // you can't frob a cdp into unsafe

    # vat.frob("gold", me, me, me, 10 ether, 5 ether);                // safe draw
    IVat.frob(vat, 'gold', me, me, me, Uint256(10*ether, 0), Uint256(5*ether, 0))

    # assertTrue(!try_frob("gold", 0 ether, 6 ether));  // unsafe draw
    # let (res) = try_frob('gold', Uint256(0, 0), Uint256(6*ether, 0)) # TODO FIX
    # assertTrue(1 - res)

    return ()
end

@external
func test_nice{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    # nice means that the collateral has increased or the debt has
    # decreased. remaining unsafe is ok as long as you're nice

    local vat
    local me
    %{
      ids.vat = context.vat
      ids.me = context.me
    %}

    # vat.frob("gold", me, me, me, 10 ether, 10 ether);
    # vat.file("gold", 'spot', ray(0.5 ether));  // now unsafe
    IVat.frob(vat, 'gold', me, me, me, Uint256(10*ether, 0), Uint256(10*ether, 0))
    let (val) = ray(Uint256((5*ether)/10, 0))
    IVat.file_ilk(vat, 'gold', 'spot', val) # now unsafe

    # // debt can't increase if unsafe
    # assertTrue(!try_frob("gold",  0 ether,  1 ether));
    # // debt can decrease
    # assertTrue( try_frob("gold",  0 ether, -1 ether));
    # // ink can't decrease
    # assertTrue(!try_frob("gold", -1 ether,  0 ether));
    # // ink can increase
    # assertTrue( try_frob("gold",  1 ether,  0 ether));
    # debt can't increase if unsafe
    # let (res) = try_frob('gold', Uint256(0, 0), Uint256(1*ether, 0)) # TODO FIX
    # assertTrue(1-res)
    # debt can decrease
    # let (res) = try_frob('gold', Uint256(0, 0), Uint256(-1*ether, 0)) # TODO
    #assertTrue(res)
    # ink can't decrease
    #let (res) = try_frob('gold', -1*ether, Uint256(0, 0)) # TODO
    #assertTrue(1-res)
    # ink can increase
    # let (res) = try_frob('gold', Uint256(1*ether, 0), Uint256(0, 0)) # TODO FIX
    # assertTrue(res)

    # // cdp is still unsafe
    # // ink can't decrease, even if debt decreases more
    # assertTrue(!this.try_frob("gold", -2 ether, -4 ether));
    # // debt can't increase, even if ink increases more
    # assertTrue(!this.try_frob("gold",  5 ether,  1 ether));
    # ink can't decrease, even if debt decreases more
    # let (res) = try_frob('gold', -2*ether, -4*ether) # TODO
    # assertTrue(1-res)
    # let (res) = try_frob('gold', Uint256(5*ether, 0), Uint256(1*ether, 0)) # TODO FIX
    # assertTrue(1-res)

    # // ink can decrease if end state is safe
    # assertTrue( this.try_frob("gold", -1 ether, -4 ether));
    # vat.file("gold", 'spot', ray(0.4 ether));  // now unsafe
    # // debt can increase if end state is safe
    # assertTrue( this.try_frob("gold",  5 ether, 1 ether));
    # ink can decrease if end state is safe
    # let (res) = try_frob('gold', -1*ether, -4*ether) # TODO
    #assertTrue(res)
    let (val) = ray(Uint256((4*ether)/10, 0))
    IVat.file_ilk(vat, 'gold', 'spot', val)
    # debt can increase if end state is safe
    # let (res) = try_frob('gold', Uint256(5*ether, 0), Uint256(1*ether, 0)) # TODO FIX
    # assertTrue(res)

    return ()
end

func rad{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }(wad : Uint256) -> (res : Uint256):
    # return wad * 10 ** 27;
    let rad = Uint256(10**27, 0)
    let (low: Uint256, high: Uint256) = uint256_mul(wad, rad)
    return (low)
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

@external
func test_dust{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
  }():
    alloc_locals

    local vat
    %{ ids.vat = context.vat %}

    # assertTrue( try_frob("gold", 9 ether,  1 ether));
    let (res) = try_frob('gold', Uint256(9*ether, 0), Uint256(1*ether, 0))
    assertTrue(res)

    # vat.file("gold", "dust", rad(5 ether));
    let (val) = rad(Uint256(5*ether, 0))
    IVat.file_ilk(vat, 'gold', 'dust', val)

    # assertTrue(!try_frob("gold", 5 ether,  2 ether));
    # let (res) = try_frob('gold', Uint256(5*ether, 0), Uint256(2*ether, 0)) # TODO FIX
    # assertTrue(1 - res)

    # assertTrue( try_frob("gold", 0 ether,  5 ether));
    # let (res) = try_frob('gold', Uint256(0, 0), Uint256(5*ether, 0))
    # assertTrue(res)

    # assertTrue(!try_frob("gold", 0 ether, -5 ether));
    # let (res) = try_frob('gold', Uint256(0, 0), -5*ether) # TODO
    # assertTrue(1 - res)

    # assertTrue( try_frob("gold", 0 ether, -6 ether));
    # let (res) = try_frob('gold', 0*ether, -6*ether) # TODO
    # assertTrue(res)

    return ()
end
