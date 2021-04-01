const etherlime = require("etherlime-lib");
const ethers = require("ethers");
const WHBAR = require("../build/WrappedToken.json");
const Router = require("../build/Router.json");
const Controller = require("../build/Controller.json");


const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";
// NOTE: Set the correct multisig owner of the contracts
const multisigWallet = "0x39F00e926DeE09De7f44646a640e83fd912Bec17";
const wrappedId = ethers.utils.formatBytes32String("hbar");

// 5% multiplied by 1000
const serviceFee = "5000";

const deploy = async (network, secret) => {

    let deployer;

    if (!network) {
        deployer = new etherlime.EtherlimeGanacheDeployer();
    } else {
        deployer = new etherlime.InfuraPrivateKeyDeployer(secret, network, INFURA_PROVIDER);
    }

    controllerInstance = await deployer.deploy(Controller);
    whbarInstance = await deployer.deploy(WHBAR, {}, "Wrapped HBAR", "WHBAR", 8);
    routerInstance = await deployer.deploy(Router, {}, serviceFee, controllerInstance.contractAddress);

    await routerInstance.updateWrappedToken(whbarInstance.contractAddress, wrappedId, true);
    await whbarInstance.setControllerAddress(controllerInstance.contractAddress);

    // TODO: uncomment for prod
    // await whbarInstance.transferOwnership(multisigWallet);
    // await routerInstance.transferOwnership(multisigWallet);
};

module.exports = {
    deploy
};
