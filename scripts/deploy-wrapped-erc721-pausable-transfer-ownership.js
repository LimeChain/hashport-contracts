const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function deployWrappedERC721PausableTransferOwnership(routerAddress, name, symbol) {
  await hardhat.run('compile');

  const wrappedERC721Factory = await ethers.getContractFactory('WrappedERC721Pausable');
  const wrappedERC721 = await wrappedERC721Factory.deploy(name, symbol);
  console.log('Deploying Wrapped-ERC721Pausable, please wait...');
  await wrappedERC721.deployed();
  console.log(`Wrapped ERC-721Pausable address [${wrappedERC721.address}], Name [${await wrappedERC721.name()}], Symbol [${await wrappedERC721.symbol()}]`);

  console.log(`Transferring ownership to [${routerAddress}], please wait...`);
  const tx = await wrappedERC721.transferOwnership(routerAddress);
  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait(10); // Wait 10 blocks before verification in case Etherscan nodes do not have the contract bytecode yet.

  console.log(`Successfully transferred ownership to [${await wrappedERC721.owner()}].`);

  await hardhat.run('verify:verify', {
    address: wrappedERC721.address,
    constructorArguments: [name, symbol]
  });
}

module.exports = deployWrappedERC721PausableTransferOwnership;