const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function deployWrappedToken(name, symbol, decimals) {
  await hardhat.run('compile');

  const tokenFactory = await ethers.getContractFactory('WrappedToken');
  const token = await tokenFactory.deploy(name, symbol, decimals);

  console.log('Deploying contract, please wait...');
  await token.deployed();
  console.log('Wrapped Token deployed to address: ', token.address);
  await token.deployTransaction.wait(10);

  console.log('Verification, please wait...');

  await hardhat.run('verify:verify', {
    address: token.address,
    constructorArguments: [name, symbol, decimals]
  });
}

module.exports = deployWrappedToken;