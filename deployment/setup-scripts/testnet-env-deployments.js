const etherlime = require("etherlime-lib");
const WrappedToken = require("../../build/WrappedToken.json");
const Router = require("../../build/Router.json");
const Controller = require("../../build/Controller.json");
const ethers = require("ethers");
const yargs = require("yargs");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";

const serviceFee = "5000";
const membersSendAmount = ethers.utils.parseEther("0.3");
const wrappedId = ethers.utils.formatBytes32String("HBAR");

const argv = yargs.option("deployToken", {
    alias: "t",
    description: "Deploy wrapped token",
    type: "string",
}).option("membersCount", {
    alias: "m",
    description: "Deploy wrapped token",
    type: "int",
}).argv;

const deploy = async (network, secret) => {
    let deployer;

    if (!network) {
        deployer = new etherlime.EtherlimeGanacheDeployer();
    } else {
        deployer = new etherlime.InfuraPrivateKeyDeployer(secret, network, INFURA_PROVIDER);
    }

    controllerInstance = await deployer.deploy(Controller);

    whbarInstance = await deployer.deploy(WrappedToken, {}, "Wrapped HBAR", "WHBAR", 8);
    routerInstance = await deployer.deploy(Router, {}, serviceFee, controllerInstance.contractAddress);

    await whbarInstance.setControllerAddress(controllerInstance.contractAddress);

    await controllerInstance.setRouterAddress(routerInstance.contractAddress);

    await routerInstance.updateWrappedToken(whbarInstance.contractAddress, wrappedId, true);

    if (argv.deployToken) {
        wtokenInstance = await deployer.deploy(WrappedToken, {}, "Wrapped Token", "WTKN", 8);
        await wtokenInstance.setControllerAddress(controllerInstance.contractAddress);
        const wrappedTokenId = ethers.utils.formatBytes32String(argv.deployToken);
        await routerInstance.updateWrappedToken(wtokenInstance.contractAddress, wrappedTokenId, true);
    }

    const adminWallet = new ethers.Wallet(secret, deployer.provider);

    for (let i = 0; i < argv.membersCount; i++) {
        const wallet = new ethers.Wallet.createRandom();
        console.log(`Wallet ${i}: `);
        console.log("Private Key: ", wallet.privateKey);
        console.log("Address: ", wallet.address);
        console.log("----------------->");

        let updateMember = await routerInstance.updateMember(wallet.address, true, {
            gasLimit: 3000000
        });
        updateMember.wait();

        let sendTransaction = await adminWallet.sendTransaction({
            to: wallet.address,
            value: membersSendAmount
        });
        sendTransaction.wait();
    }
};

module.exports = {
    deploy
};