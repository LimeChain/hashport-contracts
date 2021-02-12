const etherlime = require("etherlime-lib");
const WHBAR = require("../build/WHBAR");

describe("WHBAR", function () {
    let alice = accounts[1].signer;
    let owner = accounts[9];
    let minter = accounts[8].signer;
    let whbarInstace;

    const name = "WrapedHBAR";
    const symbol = "WHBAR";
    const decimals = 8;


    beforeEach(async () => {
        deployer = new etherlime.EtherlimeGanacheDeployer(owner.secretKey);
        whbarInstace = await deployer.deploy(
            WHBAR,
            {},
            name,
            symbol,
            decimals
        );
    });

    it("should deploy token contract", async () => {
        assert.isAddress(
            whbarInstace.contractAddress,
            "The contract was not deployed"
        );
        const _owner = await whbarInstace.owner();
        assert.equal(_owner, owner.signer.address);
    });

    it("should set bridge contract address as minter", async () => {
        await whbarInstace.setBridgeContractAddress(
            minter.address,
        );
        const controllerAddress = await whbarInstace.controllerAddress();
        assert.strictEqual(controllerAddress, minter.address, "The bridge address was not set corectly");
    });

    it("should revert if not owner tries to set bridge contract address", async () => {
        const expectedRevertMessage = "Ownable: caller is not the owner";

        await assert.revertWith(whbarInstace.from(alice).setBridgeContractAddress(minter.address), expectedRevertMessage);
    });
});
