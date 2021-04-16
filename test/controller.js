const { expect } = require("chai");

const name = "WrapedHBAR";
const symbol = "WrappedToken";
const decimals = 8;

describe("Controller", function () {
    let Controller, controllerInstance;

    beforeEach(async () => {
        [owner, notOwner, routerInstance] = await ethers.getSigners();
        Controller = await ethers.getContractFactory("Controller");
        controllerInstance = await Controller.deploy();
        await controllerInstance.deployed();

        WrappedToken = await ethers.getContractFactory("WrappedToken");
        wrappedTokenInstance = await WrappedToken.deploy(
            name,
            symbol,
            decimals,
            controllerInstance.address
        );
        await wrappedTokenInstance.deployed();
    });

    describe("Contract Setup", function () {
        it("Should set a router address", async () => {
            await controllerInstance.setRouter(routerInstance.address);
            const routerAddressSet = await controllerInstance.router();
            expect(routerAddressSet).to.eq(routerInstance.address);
        });

        it("Should not set a router address if not called from owner", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";

            await expect(
                controllerInstance
                    .connect(notOwner)
                    .setRouter(routerInstance.address)
            ).to.revertedWith(expectedRevertMessage);
        });

        it("Should not set a router address if address = 0x0", async () => {
            const nonValidAddress = ethers.constants.AddressZero;
            const expectedRevertMessage =
                "WrappedToken: router address cannot be zero";
            await expect(
                controllerInstance.setRouter(nonValidAddress)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should mint from router", async () => {
            await controllerInstance.setRouter(routerInstance.address);
            const amount = ethers.utils.parseEther("5");
            await controllerInstance
                .connect(routerInstance)
                .mint(wrappedTokenInstance.address, notOwner.address, amount);
        });

        it("Should revert if tries to mint not from router", async () => {
            await controllerInstance.setRouter(routerInstance.address);
            const expectedRevertMessage =
                "Controller: Not called by the router contract";
            const amount = ethers.utils.parseEther("5");
            await expect(
                controllerInstance
                    .connect(notOwner)
                    .mint(
                        wrappedTokenInstance.address,
                        notOwner.address,
                        amount
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });
    });
});
