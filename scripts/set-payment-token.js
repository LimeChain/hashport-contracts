const hardhat = require('hardhat')
const ethers = hardhat.ethers;

async function setPaymentToken(routerAddress, paymentToken, status) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('PaymentFacet', routerAddress);
  const tx = await router.setPaymentToken(
    paymentToken,
    status);

  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait();

  console.log(`Updated payment token [${paymentToken}] to [${routerAddress}] with status [${status}]`);
}

module.exports = setPaymentToken;