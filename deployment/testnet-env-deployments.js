const etherlime = require("etherlime-lib");
const WrappedToken = require("../build/WrappedToken.json");
const Router = require("../build/Router.json");
const Controller = require("../build/Controller.json");
const ethers = require("ethers");
const yargs = require('yargs');

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";

const serviceFee = "5000";
const membersSendAmount = ethers.utils.parseEther("0.1");
const wrappedId = ethers.utils.formatBytes32String("HBAR");

const argv = yargs.option('deployToken', {
    alias: 't',
    description: 'Deploy wrapped token',
    type: 'string',
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

    const aliceWallet = new ethers.Wallet.createRandom();
    console.log("Alice Wallet: ");
    console.log("Private Key: ", aliceWallet.privateKey);
    console.log("Address: ", aliceWallet.address);
    console.log('----------------->');

    const bobWallet = new ethers.Wallet.createRandom();
    console.log("Bob Wallet: ");
    console.log("Private Key: ", bobWallet.privateKey);
    console.log("Address: ", bobWallet.address);
    console.log('----------------->');

    const carolWallet = new ethers.Wallet.createRandom();
    console.log("Carol Wallet: ");
    console.log("Private Key: ", carolWallet.privateKey);
    console.log("Address: ", carolWallet.address);
    console.log('----------------->');

    await routerInstance.updateMember(aliceWallet.address, true, {
        gasLimit: 3000000
    });
    await routerInstance.updateMember(bobWallet.address, true, {
        gasLimit: 3000000
    });
    await routerInstance.updateMember(carolWallet.address, true, {
        gasLimit: 3000000
    });

    const adminWallet = new ethers.Wallet(secret, deployer.provider);

    await adminWallet.sendTransaction({
        to: aliceWallet.address,
        value: membersSendAmount
    });

    await adminWallet.sendTransaction({
        to: bobWallet.address,
        value: membersSendAmount
    });

    await adminWallet.sendTransaction({
        to: carolWallet.address,
        value: membersSendAmount
    });
};

module.exports = {
    deploy
};