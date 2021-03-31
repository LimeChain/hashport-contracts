const etherlime = require("etherlime-lib");
const Controller = require("../build/Controller.json");
const ethers = require("ethers");


describe("Controller", function () {
    this.timeout(10000);

    let owner = accounts[9];
    let notOwner = accounts[8];
    let routerInstance = accounts[1].signer.address;

    beforeEach(async () => {
        deployer = new etherlime.EtherlimeGanacheDeployer(owner.secretKey);
        controllerInstance = await deployer.deploy(Controller);
    });

    describe("Contract Setup", function () {

        it("Should deploy Controller contract", async () => {
            assert.isAddress(
                controllerInstance.contractAddress,
                "The contract was not deployed"
            );
        });

        it("Should set a router address", async () => {
            await controllerInstance.setRouterAddress(routerInstance);
            const routerAddressSet = await controllerInstance.routerAddress();
            assert.equal(routerAddressSet, routerInstance);
        });

        it("Should not set a router address if not called from owner", async () => {
            await assert.revert(controllerInstance.from(notOwner).setRouterAddress(routerInstance));
        });

        it("Should not set a router address if address = 0x0", async () => {
            const nonValidAddress = ethers.constants.AddressZero;
            await assert.revert(controllerInstance.setRouterAddress(nonValidAddress));
        });
    });
});
