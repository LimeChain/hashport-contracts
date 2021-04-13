const name = "Wrapped Token";
const symbol = "WTKN";
const decimals = 8;

const deploy = async (controllerAddress) => {
    console.log('Deployng Wrapped Token...');
    const WrappedToken = await ethers.getContractFactory("WrappedToken");
    const wrappedTokenInstance = await WrappedToken.deploy(name, symbol, decimals);
    await wrappedTokenInstance.deployed();
    console.log(`Wrtapped token deployed successfully at address ${wrappedTokenInstance.address}`);

    console.log('Setting up controller address...');
    await wrappedTokenInstance.setControllerAddress(controllerAddress);
    console.log('Deployment script finished successfully');
};

module.exports = deploy;
