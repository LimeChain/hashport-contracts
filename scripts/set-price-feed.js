const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function setPriceFeed(routerAddress, priceFeedAddress) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
  const tx = await router.setPriceFeedAddress(priceFeedAddress);

  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait();

  console.log(`Set price feed [${priceFeedAddress}] on router [${routerAddress}]`);
}

module.exports = setPriceFeed;
