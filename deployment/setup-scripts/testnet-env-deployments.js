const { ethers } = require("hardhat");

const serviceFee = "5000";
const membersSendAmount = ethers.utils.parseEther("0.3");
const wrappedId = ethers.utils.formatBytes32String("HBAR");

const name = "WrapedHBAR";
const symbol = "WHBAR";
const decimals = 8;

const deploy = async (deployToken, membersCount) => {
    let [adminWallet, _] = await ethers.getSigners();

    console.log('Deployng Wrapped HBAR...');
    const WrappedToken = await ethers.getContractFactory("WrappedToken");
    const wrappedTokenInstance = await WrappedToken.deploy(name, symbol, decimals);
    await wrappedTokenInstance.deployed();
    console.log(`Wrapped HBAR Deployed at ${wrappedTokenInstance.address}`);

    console.log('Deployng Controller contract');
    const Controller = await ethers.getContractFactory("Controller");
    const controllerInstance = await Controller.deploy();
    await controllerInstance.deployed();
    console.log(`Wrapped HBAR Deployed at ${controllerInstance.address}`);

    console.log('Deployng Router contract');
    const Router = await ethers.getContractFactory("Router");
    const routerInstance = await Router.deploy(serviceFee, controllerInstance.address);
    await routerInstance.deployed();
    console.log(`Router contract deployed at ${routerInstance.address}`);

    await wrappedTokenInstance.setControllerAddress(controllerInstance.address);
    await controllerInstance.setRouterAddress(routerInstance.address);

    await routerInstance.updateWrappedToken(wrappedTokenInstance.address, wrappedId, true);

    if (deployToken) {
        console.log('Deploying wrapped token...');

        let wtokenInstance = await WrappedToken.deploy("Wrapped Token", "WTKN", decimals);
        await wtokenInstance.deployed();

        await wtokenInstance.setControllerAddress(controllerInstance.address);
        const wrappedTokenId = ethers.utils.formatBytes32String(deployToken);
        await routerInstance.updateWrappedToken(wtokenInstance.address, wrappedTokenId, true);
        console.log(`Wrapped Token deployed at ${wtokenInstance.address}`);
    }

    for (let i = 0; i < membersCount; i++) {
        const wallet = new ethers.Wallet.createRandom();
        console.log(`Wallet ${i}: `);
        console.log("Private Key: ", wallet.privateKey);
        console.log("Address: ", wallet.address);
        console.log("----------------->");

        let updateMember = await routerInstance.updateMember(wallet.address, true, {
            gasLimit: 3000000
        });
        await updateMember.wait();

        let sendTransaction = await adminWallet.sendTransaction({
            to: wallet.address,
            value: membersSendAmount
        });
        await sendTransaction.wait();
    }
    console.log('Deployment script finished successfully');

};

module.exports = deploy;