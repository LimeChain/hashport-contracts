const etherlime = require("etherlime-lib");
const WHBAR = require("../build/WHBAR.json");
const Bridge = require("../build/Bridge.json");
const ethers = require("ethers");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";

const serviceFee = "5000";
const membersSendAmount = ethers.utils.parseEther("0.1");

const deploy = async (network, secret) => {
    let deployer;

    if (!network) {
        deployer = new etherlime.EtherlimeGanacheDeployer();
    } else {
        deployer = new etherlime.InfuraPrivateKeyDeployer(secret, network, INFURA_PROVIDER);
    }

    whbarInstance = await deployer.deploy(WHBAR, {}, "Name", "Symbol", 8);
    bridgeInstance = await deployer.deploy(Bridge, {}, whbarInstance.contractAddress, serviceFee);

    await whbarInstance.setControllerAddress(bridgeInstance.contractAddress);

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

    await bridgeInstance.updateMember(aliceWallet.address, true);
    await bridgeInstance.updateMember(bobWallet.address, true);
    await bridgeInstance.updateMember(carolWallet.address, true);


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