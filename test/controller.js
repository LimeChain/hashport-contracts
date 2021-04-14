const { expect } = require("chai");

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
            await controllerInstance.setRouter(routerInstance.address);
            const routerAddressSet = await controllerInstance.router();
            expect(routerAddressSet).to.eq(routerInstance.address);
        });

        it("Should not set a router address if not called from owner", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";

            await expect(controllerInstance.connect(notOwner).setRouter(routerInstance.address)).to.revertedWith(expectedRevertMessage);
        });

        it("Should not set a router address if address = 0x0", async () => {
            const nonValidAddress = ethers.constants.AddressZero;
            const expectedRevertMessage = "WrappedToken: router address cannot be zero";
            await expect(controllerInstance.setRouter(nonValidAddress)).to.be.revertedWith(expectedRevertMessage);
        });
    });
});
