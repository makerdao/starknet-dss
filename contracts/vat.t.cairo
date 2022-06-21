// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.13;

import "ds-test/test.sol";

import {Vat} from '../Vat.sol';
import {Jug} from '../Jug.sol';
import {GemJoin} from '../GemJoin.sol';
import {DaiJoin} from '../DaiJoin.sol';

import {MockToken} from './mocks/Token.sol';


interface Hevm {
    function warp(uint256) external;
    function store(address,bytes32,bytes32) external;
}

contract TestVat is Vat {
    uint256 constant ONE = 10 ** 27;
    function mint(address usr, uint256 wad) public {
        dai[usr] += wad * ONE;
        debt += wad * ONE;
    }
}

contract JoinTest is DSTest {
    TestVat   vat;
    MockToken gem;
    GemJoin   gemA;
    DaiJoin   daiA;
    MockToken dai;
    address   me;

    function setUp() public {
        vat = new TestVat();
        vat.init("eth");

        gem  = new MockToken("Gem");
        gemA = new GemJoin(address(vat), "gem", address(gem));
        vat.rely(address(gemA));

        dai  = new MockToken("Dai");
        daiA = new DaiJoin(address(vat), address(dai));

        me = address(this);
    }
    function try_cage(address a) public payable returns (bool ok) {
        string memory sig = "cage()";
        (ok,) = a.call(abi.encodeWithSignature(sig));
    }
    function try_join_gem(address usr, uint256 wad) public returns (bool ok) {
        string memory sig = "join(address,uint256)";
        (ok,) = address(gemA).call(abi.encodeWithSignature(sig, usr, wad));
    }
    function try_exit_dai(address usr, uint256 wad) public returns (bool ok) {
        string memory sig = "exit(address,uint256)";
        (ok,) = address(daiA).call(abi.encodeWithSignature(sig, usr, wad));
    }
    function test_gem_join() public {
        gem.mint(20 ether);
        gem.approve(address(gemA), 20 ether);
        assertTrue( try_join_gem(address(this), 10 ether));
        assertEq(vat.gem("gem", me), 10 ether);
        assertTrue( try_cage(address(gemA)));
        assertTrue(!try_join_gem(address(this), 10 ether));
        assertEq(vat.gem("gem", me), 10 ether);
    }
    function rad(uint256 wad) internal pure returns (uint) {
        return wad * 10 ** 27;
    }
    function test_dai_exit() public {
        address urn = address(this);
        vat.mint(address(this), 100 ether);
        vat.hope(address(daiA));
        assertTrue( try_exit_dai(urn, 40 ether));
        assertEq(dai.balanceOf(address(this)), 40 ether);
        assertEq(vat.dai(me),              rad(60 ether));
    }
    function test_dai_exit_join() public {
        address urn = address(this);
        vat.mint(address(this), 100 ether);
        vat.hope(address(daiA));
        daiA.exit(urn, 60 ether);
        dai.approve(address(daiA), type(uint256).max);
        daiA.join(urn, 30 ether);
        assertEq(dai.balanceOf(address(this)),     30 ether);
        assertEq(vat.dai(me),                  rad(70 ether));
    }
    function test_cage_no_access() public {
        gemA.deny(address(this));
        assertTrue(!try_cage(address(gemA)));
    }
}

contract FoldTest is DSTest {
    Vat vat;

    function ray(uint256 wad) internal pure returns (uint) {
        return wad * 10 ** 9;
    }
    function rad(uint256 wad) internal pure returns (uint) {
        return wad * 10 ** 27;
    }
    function tab(bytes32 ilk, address urn) internal view returns (uint) {
        (uint256 ink_, uint256 art_) = vat.urns(ilk, urn); ink_;
        (uint256 Art_, uint256 rate, uint256 spot, uint256 line, uint256 dust) = vat.ilks(ilk);
        Art_; spot; line; dust;
        return art_ * rate;
    }
    function jam(bytes32 ilk, address urn) internal view returns (uint) {
        (uint256 ink_, uint256 art_) = vat.urns(ilk, urn); art_;
        return ink_;
    }

    function setUp() public {
        vat = new Vat();
        vat.init("gold");
        vat.file("Line", rad(100 ether));
        vat.file("gold", "line", rad(100 ether));
    }
    function draw(bytes32 ilk, uint256 dai) internal {
        vat.file("Line", rad(dai));
        vat.file(ilk, "line", rad(dai));
        vat.file(ilk, "spot", 10 ** 27 * 10000 ether);
        address self = address(this);
        vat.slip(ilk, self,  10 ** 27 * 1 ether);
        vat.frob(ilk, self, self, self, int256(1 ether), int256(dai));
    }
    function test_fold() public {
        address self = address(this);
        address ali  = address(bytes20("ali"));
        draw("gold", 1 ether);

        assertEq(tab("gold", self), rad(1.00 ether));
        vat.fold("gold", ali,   int256(ray(0.05 ether)));
        assertEq(tab("gold", self), rad(1.05 ether));
        assertEq(vat.dai(ali),      rad(0.05 ether));
    }
}

contract ForkTest is DSTest {
    Vat vat;
    Usr ali;
    Usr bob;
    address a;
    address b;

    function ray(uint wad) internal pure returns (uint) {
        return wad * 10 ** 9;
    }
    function rad(uint wad) internal pure returns (uint) {
        return wad * 10 ** 27;
    }

    function setUp() public {
        vat = new Vat();
        ali = new Usr(vat);
        bob = new Usr(vat);
        a = address(ali);
        b = address(bob);

        vat.init("gems");
        vat.file("gems", "spot", ray(0.5  ether));
        vat.file("gems", "line", rad(1000 ether));
        vat.file("Line",         rad(1000 ether));

        vat.slip("gems", a, 8 ether);
    }
    function test_fork_to_self() public {
        ali.frob("gems", a, a, a, 8 ether, 4 ether);
        assertTrue( ali.can_fork("gems", a, a, 8 ether, 4 ether));
        assertTrue( ali.can_fork("gems", a, a, 4 ether, 2 ether));
        assertTrue(!ali.can_fork("gems", a, a, 9 ether, 4 ether));
    }
    function test_give_to_other() public {
        ali.frob("gems", a, a, a, 8 ether, 4 ether);
        assertTrue(!ali.can_fork("gems", a, b, 8 ether, 4 ether));
        bob.hope(address(ali));
        assertTrue( ali.can_fork("gems", a, b, 8 ether, 4 ether));
    }
    function test_fork_to_other() public {
        ali.frob("gems", a, a, a, 8 ether, 4 ether);
        bob.hope(address(ali));
        assertTrue( ali.can_fork("gems", a, b, 4 ether, 2 ether));
        assertTrue(!ali.can_fork("gems", a, b, 4 ether, 3 ether));
        assertTrue(!ali.can_fork("gems", a, b, 4 ether, 1 ether));
    }
    function test_fork_dust() public {
        ali.frob("gems", a, a, a, 8 ether, 4 ether);
        bob.hope(address(ali));
        assertTrue( ali.can_fork("gems", a, b, 4 ether, 2 ether));
        vat.file("gems", "dust", rad(1 ether));
        assertTrue( ali.can_fork("gems", a, b, 2 ether, 1 ether));
        assertTrue(!ali.can_fork("gems", a, b, 1 ether, 0.5 ether));
    }
}
