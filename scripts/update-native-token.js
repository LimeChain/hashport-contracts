const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function updateNativeToken(routerAddress, nativeToken, feePercentage, status) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
  const tx = await router.updateNativeToken(
    nativeToken,
    feePercentage,
    status);

  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait();

  console.log(`Updated native token [${nativeToken}] to [${routerAddress}] with status [${status}]`);
}

module.exports = updateNativeToken;