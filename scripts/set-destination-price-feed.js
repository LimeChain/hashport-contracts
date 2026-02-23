const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function setDestinationPriceFeed(routerAddress, chainId, priceFeedAddress) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
  const tx = await router.setDestinationChainPriceFeed(chainId, priceFeedAddress);

  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait();

  console.log(`Set price feed [${priceFeedAddress}] for chain [${chainId}] on router [${routerAddress}]`);
}

module.exports = setDestinationPriceFeed;
