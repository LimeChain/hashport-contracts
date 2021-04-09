const etherlime = require("etherlime-lib");
const WrappedToken = require("../../build/WrappedToken.json");
const ethers = require("ethers");
const yargs = require("yargs");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";

const argv = yargs.option("controllerAddress", {
    alias: "c",
    description: "Deployed controller address",
    type: "string",
}).argv;

const name = "Wrapped Token";
const symbol = "WTKN";
const decimals = 8;

const deploy = async (network, secret) => {
    let deployer;

    if (!network) {
        deployer = new etherlime.EtherlimeGanacheDeployer();
    } else {
        deployer = new etherlime.InfuraPrivateKeyDeployer(secret, network, INFURA_PROVIDER);
    }

    whbarInstance = await deployer.deploy(WrappedToken, {}, name, symbol, decimals);

    await whbarInstance.setControllerAddress(argv.controllerAddress);
};

module.exports = {
    deploy
};