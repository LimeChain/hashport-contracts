const hardhat = require('hardhat')
const ethers = hardhat.ethers;
const { Wallet, utils } =  require("zksync-web3");
const { Deployer } =  require( "@matterlabs/hardhat-zksync-deploy");

async function deployToken(name, symbol, decimals) {
  await hardhat.run('compile');

  const wallet = new Wallet(`0x${hardhat.config.privateKey}`);
  const deployer = new Deployer(hre, wallet);

  const tokenFactory = await deployer.loadArtifact('Token');
  const token = await deployer.deploy(tokenFactory, [name, symbol, decimals]);

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