const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function deployWrappedToken(routerAddress, sourceChain, nativeToken, name, symbol, decimals) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
  const tx = await router.deployWrappedToken(
    sourceChain,
    ethers.utils.toUtf8Bytes(nativeToken),
    { name, symbol, decimals });

  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  const receipt = await tx.wait();

  const wrappedTokenAddress = receipt.events[1].args.wrappedToken;

  console.log(`Deployed wrapped token at [${wrappedTokenAddress}]`);

  console.log('Verification, please wait...');

  await hardhat.run('verify:verify', {
    address: wrappedTokenAddress,
    constructorArguments: [name, symbol, decimals]
  });
}

module.exports = deployWrappedToken;