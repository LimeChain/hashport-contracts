const { expect, assert } = require("chai");

describe("Controller", function () {

    let Controller, controllerInstance;


    beforeEach(async () => {
        [owner, notOwner, routerInstance] = await ethers.getSigners();
        Controller = await ethers.getContractFactory("Controller");
        controllerInstance = await Controller.deploy();
        await controllerInstance.deployed();
    });

    describe("Contract Setup", function () {
        it("Should set a router address", async () => {
            await controllerInstance.setRouterAddress(routerInstance.address);
            const routerAddressSet = await controllerInstance.routerAddress();
            expect(routerAddressSet).to.eq(routerInstance.address);
        });

        it("Should not set a router address if not called from owner", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";

            await expect(controllerInstance.connect(notOwner).setRouterAddress(routerInstance.address)).to.revertedWith(expectedRevertMessage);
        });

        it("Should not set a router address if address = 0x0", async () => {
            const nonValidAddress = ethers.constants.AddressZero;
            const expectedRevertMessage = "WrappedToken: router address cannot be zero";
            await expect(controllerInstance.setRouterAddress(nonValidAddress)).to.be.revertedWith(expectedRevertMessage);
        });
    });
});
