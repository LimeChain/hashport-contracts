const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function setERC721Payment(routerAddress, erc721, paymentToken, fee) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('ERC721PortalFacet', routerAddress);
  const tx = await router.setERC721Payment(erc721, paymentToken, fee);

  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait();

  console.log(`Successfully set ERC-721 [${erc721}] with payment token [${paymentToken}] to [${routerAddress}] and fee [${fee}]`);
}

module.exports = setERC721Payment;