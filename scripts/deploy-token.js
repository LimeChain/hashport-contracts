const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function deployToken(name, symbol, decimals) {
  await hardhat.run('compile');

  const tokenFactory = await ethers.getContractFactory('Token');
  const token = await tokenFactory.deploy(name, symbol, decimals);

  console.log('Deploying contract, please wait...');
  await token.deployed();
  console.log('Token deployed to address: ', token.address);

  console.log('Verification, please wait...');

  await hardhat.run('verify:verify', {
    address: token.address,
    constructorArguments: [name, symbol, decimals]
  });
}

module.exports = deployToken;