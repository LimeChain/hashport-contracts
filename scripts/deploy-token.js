const deploy = async (controllerAddress, name, symbol, decimals) => {
    console.log('Deployng Wrapped Token...');
    const WrappedToken = await ethers.getContractFactory("WrappedToken");
    const wrappedTokenInstance = await WrappedToken.deploy(name, symbol, decimals, controllerAddress);
    await wrappedTokenInstance.deployed();
    console.log(`Wrtapped token deployed successfully at address ${wrappedTokenInstance.address}`);
    console.log('Deployment script finished successfully');
};

module.exports = deploy;
