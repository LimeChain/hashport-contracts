const etherlime = require("etherlime-lib");
const WHBAR = require("../build/WHBAR.json");
const Bridge = require("../build/Bridge.json");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";
const multisigWallet = "0x785c864b9F3Cf790478c3473B86FBA6BD75A6365";

// 5% multiplied by 1000
const serviceFee = "5000";

const deploy = async (network, secret) => {
    let deployer;

    if (!network) {
        deployer = new etherlime.EtherlimeGanacheDeployer();
    } else {
        deployer = new etherlime.InfuraPrivateKeyDeployer(secret, network, INFURA_PROVIDER);
    }

    whbarInstance = await deployer.deploy(WHBAR, {}, "Name", "Symbol", 8);
    bridgeInstance = await deployer.deploy(Bridge, {}, whbarInstance.contractAddress, serviceFee);

    await whbarInstance.setBridgeContractAddress(bridgeInstance.contractAddress);
    await whbarInstance.transferOwnership(multisigWallet);
    await bridgeInstance.transferOwnership(multisigWallet);
};

module.exports = {
    deploy
};