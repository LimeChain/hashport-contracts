const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function deployWrappedERC721TransferOwnership(routerAddress, name, symbol) {
  await hardhat.run('compile');

  const wrappedERC721Factory = await ethers.getContractFactory('WrappedERC721');
  const wrappedERC721 = await wrappedERC721Factory.deploy(name, symbol);
  console.log('Deploying Wrapped-ERC721, please wait...');
  await wrappedERC721.deployed();
  console.log(`Wrapped ERC-721 address [${wrappedERC721.address}], Name [${await wrappedERC721.name()}], Symbol [${await wrappedERC721.symbol()}]`);

  console.log(`Transferring ownership to [${routerAddress}], please wait...`);
  const tx = await wrappedERC721.transferOwnership(routerAddress);
  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait();

  console.log(`Successfully transferred ownership to [${await wrappedERC721.owner()}].`)
}

module.exports = deployWrappedERC721TransferOwnership;