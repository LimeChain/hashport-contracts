const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function deployERC721PortalFacet() {
  await hardhat.run('compile');

  const erc721PortalFacetFactory = await ethers.getContractFactory('ERC721PortalFacet');
  const erc721PortalFacet = await erc721PortalFacetFactory.deploy();
  console.log('Deploying ERC-721 Portal Facet, please wait...');
  await erc721PortalFacet.deployed();
  console.log('ERC-721 Portal Facet address: ', erc721PortalFacet.address);

  await hardhat.run('verify:verify', {
    address: erc721PortalFacet.address,
    constructorArguments: []
  });
}

module.exports = deployERC721PortalFacet;