// NOTE: Set the correct multisig owner of the contracts
const multisigWallet = "0x39F00e926DeE09De7f44646a640e83fd912Bec17";
const wrappedId = ethers.utils.formatBytes32String("hbar");

// 5% multiplied by 1000
const serviceFee = "5000";

const name = "WrapedHBAR";
const symbol = "WHBAR";
const decimals = 8;

const deploy = async () => {
    let Router, routerInstance, WrappedToken, wrappedTokenInstance, Controller, controllerInstance, receiver;

    WrappedToken = await ethers.getContractFactory("WrappedToken");
    wrappedTokenInstance = await WrappedToken.deploy(name, symbol, decimals);
    await wrappedTokenInstance.deployed();

    Controller = await ethers.getContractFactory("Controller");
    controllerInstance = await Controller.deploy();
    await controllerInstance.deployed();

    Router = await ethers.getContractFactory("Router");
    routerInstance = await Router.deploy(serviceFee, controllerInstance.address);
    await routerInstance.deployed();

    await wrappedTokenInstance.setControllerAddress(controllerInstance.address);
    await controllerInstance.setRouterAddress(routerInstance.address);

    await routerInstance.updateWrappedToken(wrappedTokenInstance.address, wrappedId, true);
    console.log(`Router instace deployed on address: ${routerInstance.address}`);

    // TODO: uncomment for prod
    // await whbarInstance.transferOwnership(multisigWallet);
    // await routerInstance.transferOwnership(multisigWallet);
};

module.exports = deploy;
