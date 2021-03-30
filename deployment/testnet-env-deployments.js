const etherlime = require("etherlime-lib");
const WrappedToken = require("../build/WrappedToken.json");
const Router = require("../build/Router.json");
const ethers = require("ethers");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";

const serviceFee = "5000";
const membersSendAmount = ethers.utils.parseEther("0.1");
const wrappedId = ethers.utils.formatBytes32String("hbar");

const deploy = async (network, secret) => {
    let deployer;

    if (!network) {
        deployer = new etherlime.EtherlimeGanacheDeployer();
    } else {
        deployer = new etherlime.InfuraPrivateKeyDeployer(secret, network, INFURA_PROVIDER);
    }

    whbarInstance = await deployer.deploy(WrappedToken, {}, "Wrapped HBAR", "WHBAR", 8);
    routerInstance = await deployer.deploy(Router, {}, serviceFee);

    await whbarInstance.setRouterAddress(routerInstance.contractAddress);

    const updateWrappedTokenTx = await routerInstance.updateWrappedToken(whbarInstance.contractAddress, wrappedId, true);
    await updateWrappedTokenTx.wait();

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

    await routerInstance.updateMember(aliceWallet.address, true);
    await routerInstance.updateMember(bobWallet.address, true);
    await routerInstance.updateMember(carolWallet.address, true);


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