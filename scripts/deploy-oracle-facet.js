const hardhat = require('hardhat');
const ethers = hardhat.ethers;
const { getSelectors } = require('../util');

async function deployOracleFacet(routerAddress, sourcePriceFeed, destinationChainIds, destinationPriceFeeds) {
  await hardhat.run('compile');

  console.log('Deploying OracleFacet, please wait...');
  const oracleFacetFactory = await ethers.getContractFactory('OracleFacet');
  const oracleFacet = await oracleFacetFactory.deploy();
  await oracleFacet.deployed();
  console.log('OracleFacet deployed at:', oracleFacet.address);

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

  const diamondCut = [
    {
      facetAddress: oracleFacet.address,
      action: 0, // Add
      functionSelectors: getSelectors(oracleFacet),
    },
  ];

  console.log('Adding OracleFacet to diamond, please wait...');
  const cutTx = await router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x');
  await cutTx.wait();
  console.log('Diamond cut successful:', cutTx.hash);

  console.log(`Initializing Oracle with source feed [${sourcePriceFeed}] and destination chains [${destinationChainIds}], please wait...`);
  const initTx = await router.initOracle(sourcePriceFeed, destinationChainIds, destinationPriceFeeds);
  await initTx.wait();

  console.log('\nOracleFacet address:', oracleFacet.address);
}

module.exports = deployOracleFacet;
