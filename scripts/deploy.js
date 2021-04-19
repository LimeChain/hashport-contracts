const deploy = async () => {
    let Router, routerInstance, Controller, controllerInstance, receiver;

    Controller = await ethers.getContractFactory("Controller");
    controllerInstance = await Controller.deploy();
    await controllerInstance.deployed();

    Router = await ethers.getContractFactory("Router");
    routerInstance = await Router.deploy(controllerInstance.address);
    await routerInstance.deployed();

    await controllerInstance.setRouter(routerInstance.address);

    console.log(
        `Router instace deployed on address: ${routerInstance.address}`
    );

    // TODO: uncomment for prod
    // const multisigWallet = "";
    // await whbarInstance.transferOwnership(multisigWallet);
    // await routerInstance.transferOwnership(multisigWallet);
};

module.exports = deploy;
