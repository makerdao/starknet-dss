import {
  getAddressOfNextDeployedContract,
  simpleDeploy,
} from "@makerdao/hardhat-utils";
import { expect } from "chai";
import hre, { ethers, network, starknet } from "hardhat";
import { HttpNetworkConfig } from "hardhat/types";

import {
  asDec,
  eth,
  getEvent,
  l2Eth,
  simpleDeployL2,
  SplitUint,
  toBytes32,
} from "./utils";

const L1_TARGET_DOMAIN = ethers.utils.formatBytes32String("1");
const L2_TARGET_DOMAIN = `0x${Buffer.from("1", "utf8").toString("hex")}`;
const L1_SOURCE_DOMAIN = ethers.utils.formatBytes32String("2");
const L2_SOURCE_DOMAIN = `0x${Buffer.from("2", "utf8").toString("hex")}`;

// Cairo encoding of "valid_domains"
const VALID_DOMAINS = "9379074284324409537785911406195";

const ILK = "SOME-ILK-A";

const TEST_ADDRESS = "9379074284324409537785911406195";

const WAD = 10 ** 18;
const RAY = 10 ** 27;
const RAD = 10 ** 45;

describe("vat", async function () {
  this.timeout(900_000); // eslint-disable-line
  let admin: any;
  let user1: any;
  let user2: any;
  let vat: any;

  before(async () => {
    // vm.expectEmit(true, true, true, true);
    // emit Rely(address(this));
    // vat = new Vat();
    // usr1 = new User(vat);
    // usr2 = new User(vat);
    // ausr1 = address(usr1);
    // ausr2 = address(usr2);

    admin = await starknet.deployAccount("OpenZeppelin");
    user1 = await starknet.deployAccount("OpenZeppelin");
    user2 = await starknet.deployAccount("OpenZeppelin");
    vat = await simpleDeployL2("Vat", [user1.address], hre);
  });

  beforeEach(async () => {
    // vat.init(ILK);
    // vat.file("Line", 1000 * RAD);
    // vat.file(ILK, "spot", RAY);     // Collateral price = $1 and 100% CR for simplicity
    // vat.file(ILK, "line", 1000 * RAD);
    // vat.file(ILK, "dust", 10 * RAD);
    await user1.invoke(vat, "init", {
      ilk: ILK,
    });
    await user1.invoke(vat, "file", {
      what: "Line",
      data: {
        low: l2Eth(1000 * RAD).toDec()[0],
        high: l2Eth(1000 * RAD).toDec()[1],
      },
    });
    await user1.invoke(vat, "file_ilk", {
      ilk: ILK,
      what: "spot",
      data: {
        low: l2Eth(RAY).toDec()[0],
        high: l2Eth(RAY).toDec()[1],
      },
    });
    await user1.invoke(vat, "file_ilk", {
      ilk: ILK,
      what: "line",
      data: {
        low: l2Eth(1000 * RAD).toDec()[0],
        high: l2Eth(1000 * RAD).toDec()[1],
      },
    });
    await user1.invoke(vat, "file_ilk", {
      ilk: ILK,
      what: "dust",
      data: {
        low: l2Eth(10 * RAD).toDec()[0],
        high: l2Eth(10 * RAD).toDec()[1],
      },
    });

    // Give some gems to the users
    // vat.slip(ILK, ausr1, int256(100 * WAD));
    // vat.slip(ILK, ausr2, int256(100 * WAD));
    await user1.invoke(vat, "slip", {
      ilk: ILK,
      usr: user1.address,
      wad: {
        low: l2Eth(100 * WAD).toDec()[0],
        high: l2Eth(100 * WAD).toDec()[1],
      },
    });
    await user1.invoke(vat, "slip", {
      ilk: ILK,
      usr: user2.address,
      wad: {
        low: l2Eth(100 * WAD).toDec()[0],
        high: l2Eth(100 * WAD).toDec()[1],
      },
    });
  });

  it("test constructor", async () => {
    // assertEq(vat.live(), 1);
    // assertEq(vat.wards(address(this)), 1);

    expect((await vat.call("live")).res).to.equal(SplitUint.fromUint(1));
    expect((await vat.call("wards")).res).to.equal(SplitUint.fromUint(1));
  });

  async function checkAuth(base: any, _contractName: string) {
    const { res: ward } = await base.call("wards", { user: user1.address });

    // await GodMode.setWard(base.address, this, 1);

    expect((await base.call("wards", { user: TEST_ADDRESS })).res).to.equal(SplitUint.fromUint(0));

    await user1.invoke(base, "rely", { user: TEST_ADDRESS });

    expect((await base.call("wards", { user: TEST_ADDRESS })).res).to.equal(SplitUint.fromUint(1));

    await user1.invoke(base, "deny", { user: TEST_ADDRESS });

    expect((await base.call("wards", { user: TEST_ADDRESS })).res).to.equal(SplitUint.fromUint(0));

    await user1.invoke(base, "deny", { user: admin.address });

    // vm.expectRevert(abi.encodePacked(_contractName, "/not-authorized"));
    await user1.invoke(base, "rely", { user: TEST_ADDRESS });
    // vm.expectRevert(abi.encodePacked(_contractName, "/not-authorized"));
    await user1.invoke(base, "deny", { user: TEST_ADDRESS });

    // await GodMode.setWard(base.address, this, ward);
  }

  async function checkFileUint(base: any, contractName: string, values: string[]) {
    const { res: ward } = await base.call("wards", { user: user1.address });

    // Ensure we have admin access
    // await GodMode.setWard(base, admin.address, 1);

    // First check an invalid value
    // vm.expectRevert(abi.encodePacked(_contractName, "/file-unrecognized-param"));
    await expect().to.revert
    await user1.invoke(base, "file", {
      what: "an invalid value",
      data: {
        low: 1,
        high: 0,
      },
    });

    // Next check each value is valid and updates the target storage slot
    for (let i=0; i<values.length; i++) {
      // Read original value
      const { res: _origData } = await base.call(`${values[i]}()`);
      const origData = new SplitUint(_origData);
      const newData = origData.add(1);

      // Update value
      // vm.expectEmit(true, false, false, true);
      // emit File(valueB32, newData);
      await base.file(values[i], newData);
      await user1.invoke(base, "file", {
        what: values[i],
        data: newData,
      });

      // Confirm it was updated successfully
      const { res: _data } = await base.call(`${values[i]}()`);
      const data = new SplitUint(_data);
      expect(data).to.equal(newData);

      // Reset value to original
      // vm.expectEmit(true, false, false, true);
      // emit File(valueB32, origData);
      await user1.invoke(base, "file", {
        what: values[i],
        data: {
          low: origData.toDec()[0],
          high: origData.toDec()[0],
        },
      });
    }

    // Finally check that file is authed
    await user1.invoke(base, "deny", { user: });
    // vm.expectRevert(abi.encodePacked(_contractName, "/not-authorized"));
    await user1.invoke(base, "file", {
      what: "some value",
      data: {
        low: 1,
        high: 0,
      },
    });

    // Reset admin access to what it was
    // GodMode.setWard(base.address, this, ward);
  }

  it("test auth", async () => {
    await checkAuth(vat, "Vat");
  });

  it("test file", async () => {
    await checkFileUint(vat, "vat", ["Line"]);
  });

  it("test file ilk", async () => {
    // vm.expectEmit(true, true, true, true);
    // emit File(ILK, "spot", 1);
    // vat.file(ILK, "spot", 1);
    await user1.invoke(vat, "file", {
      ilk: ILK,
      what: "spot",
      data: { low: 1, high: 0 },
    });
    // assertEq(vat.spot(ILK), 1);
    expect((await vat.call("spot", { ilk: ILK })).res).to.equal(SplitUint.fromUint(0));
    // vat.file(ILK, "line", 1);
    await user1.invoke(vat, "file", {
      ilk: ILK,
      what: "line",
      data: { low: 1, high: 0 },
    });
    // assertEq(vat.line(ILK), 1);
    expect((await vat.call("line", { ilk: ILK })).res).to.equal(SplitUint.fromUint(0));
    // vat.file(ILK, "dust", 1);
    await user1.invoke(vat, "file", {
      ilk: ILK,
      what: "dust",
      data: { low: 1, high: 0 },
    });
    // assertEq(vat.dust(ILK), 1);
    expect((await vat.call("dust", { ilk: ILK })).res).to.equal(SplitUint.fromUint(1));

    // Invalid name
    // vm.expectRevert("Vat/file-unrecognized-param");
    // vat.file(ILK, "badWhat", 1);
    expect(vat.file(ILK, "badWhat", 1)).to.be.revertedWith();

    // Not authed
    // vat.deny(address(this));
    await user1.invoke(vat, "deny", { user: admin.address });
    // vm.expectRevert("Vat/not-authorized");
    // vat.file(ILK, "spot", 1);
    await expect(user1.invoke(vat, "file", {
      ilk: ILK,
      what: "spot",
      data: { low: 1, high: 0 },
    })).to.be.revertedWith("Vat/not-authorized");
  });

  it("test auth modifier", async () => {
    // vat.deny(address(this));
    await user1.invoke(vat, "deny", { user: admin.address });

    // bytes[] memory funcs = new bytes[](6);
    // funcs[0] = abi.encodeWithSelector(Vat.init.selector, ILK);
    // funcs[1] = abi.encodeWithSelector(Vat.cage.selector);
    // funcs[2] = abi.encodeWithSelector(Vat.slip.selector, ILK, address(0), 0);
    // funcs[3] = abi.encodeWithSelector(Vat.grab.selector, ILK, address(0), address(0), address(0), 0, 0);
    // funcs[4] = abi.encodeWithSelector(Vat.suck.selector, address(0), address(0), 0);
    // funcs[5] = abi.encodeWithSelector(Vat.fold.selector, ILK, address(0), 0);

    // for (uint256 i = 0; i < funcs.length; i++) {
    //     assertRevert(address(vat), funcs[i], "Vat/not-authorized");
    // }
    const funcs = [
      ["init", ILK],
      ["cage"],
      ["slip", ILK, 0, 0],
      ["grab", ILK, 0, 0, 0],
      ["suck", 0, 0, 0],
      ["fold", ILK, 0, 0],
    ];
    for (let i=0; i<funcs.length; i++) {
      await expect(
        user1.invoke(vat, funcs[i][0], funcs[i].slice(1))
      ).to.revertedWith("Vat/not-authorized");
    }
  });

  it("test live", async () => {
    // vat.cage();
    await user1.invoke(vat, "cage");

    // bytes[] memory funcs = new bytes[](6);
    // funcs[0] = abi.encodeWithSelector(Vat.rely.selector, address(0));
    // funcs[1] = abi.encodeWithSelector(Vat.deny.selector, address(0));
    // funcs[2] = abi.encodeWithSignature("file(bytes32,uint256)", bytes32("Line"), 0);
    // funcs[3] = abi.encodeWithSignature("file(bytes32,bytes32,uint256)", ILK, bytes32("Line"), 0);
    // funcs[4] = abi.encodeWithSelector(Vat.frob.selector, ILK, address(0), address(0), address(0), 0, 0);
    // funcs[5] = abi.encodeWithSelector(Vat.fold.selector, ILK, address(0), 0);
    // for (uint256 i = 0; i < funcs.length; i++) {
    //     assertRevert(address(vat), funcs[i], "Vat/not-live");
    // }
    
    const funcs = [
      ["rely", 0],
      ["deny", 0],
      ["file", "Line", 0],
      ["file_ilk", ILK, "Line", 0],
      ["frob", ILK, 0, 0, 0, 0, 0],
      ["fold", ILK, 0, 0],
    ];
    for (let i=0; i<funcs.length; i++) {
      await expect(
        user1.invoke(vat, funcs[i][0], funcs[i].slice(1))
      ).to.revertedWith("Vat/not-live");
    }
  });

  it("test init", async () => {
    // assertEq(vat.rate(ILK), 0);
    expect((await vat.call("rate", { ilk: ILK })).res).to.equal(SplitUint.fromUint(0));

    // vm.expectEmit(true, true, true, true);
    // emit Init(ILK);
    // vat.init(ILK);
    await user1.invoke(vat, "init", { ilk: ILK });

    // assertEq(vat.rate(ILK), RAY);
    expect((await vat.call("rate", { ilk: ILK })).res).to.equal(SplitUint.fromUint(RAY));
  });

  it("test init can't set twice", async () => {
    // vat.init(ILK);
    await user1.invoke(vat, "init", { ilk: ILK });

    // vm.expectRevert("Vat/ilk-already-init");
    // vat.init(ILK);
    await expect(user1.invoke(vat, "init", { ilk: ILK })).to.revertedWith("Vat/ilk-already-init");
  });

  it("test cage", async () => {
    // assertEq(vat.live(), 1);
    expect((await vat.call("live")).res).to.equal(SplitUint.fromUint(1));

    // vm.expectEmit(true, true, true, true);
    // emit Cage();
    // vat.cage();
    await user1.invoke(vat, "cage");

    // assertEq(vat.live(), 0);
    expect((await vat.call("live")).res).to.equal(SplitUint.fromUint(0));
  });

  it("test hope", async () => {
    // assertEq(vat.can(address(this), TEST_ADDRESS), 0);
    expect((await vat.call("can", {
      b: admin.address,
      u: TEST_ADDRESS,
    })).res).to.equal(SplitUint.fromUint(0));

    // vm.expectEmit(true, true, true, true);
    // emit Hope(address(this), TEST_ADDRESS);
    // vat.hope(TEST_ADDRESS);
    await vat.call("hope", { user: TEST_ADDRESS });

    // assertEq(vat.can(address(this), TEST_ADDRESS), 1);
    expect((await vat.call("can", {
      b: admin.address,
      u: TEST_ADDRESS,
    })).res).to.equal(SplitUint.fromUint(0));
  });

  it("test nope", async () => {
    // vat.hope(TEST_ADDRESS);
    await user1.invoke(vat, "hope", { user: TEST_ADDRESS });

    // assertEq(vat.can(address(this), TEST_ADDRESS), 1);
    expect((await user1.invoke(vat, "can", {
      b: admin.address,
      u: TEST_ADDRESS,
    })).res).to.equal(SplitUint.fromUint(0));

    // vm.expectEmit(true, true, true, true);
    // emit Nope(address(this), TEST_ADDRESS);
    // vat.nope(TEST_ADDRESS);
    await user1.invoke(vat, "nope", { user: TEST_ADDRESS });

    // assertEq(vat.can(address(this), TEST_ADDRESS), 0);
    expect((await vat.call("can", {
      b: admin.address,
      u: TEST_ADDRESS,
    })).res).to.equal(SplitUint.fromUint(0));
  });

  describe("slip", async function () {
  });
  describe("flux", async function () {
  });
  describe("move", async function () {
  });
  describe("frob", async function () {
  });
  describe("fork", async function () {
  });
  describe("grab", async function () {
  });
  it("test heal", async () => {
  });
  it("test suck", async () => {
  });
  describe("fold", async function () {
  });
  describe("swell", async function () {
  });
  describe("join", async function () {
  });
});
