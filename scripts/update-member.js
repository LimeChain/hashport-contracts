const hardhat = require('hardhat');
const ethers = hardhat.ethers;

async function updateMember(routerAddress, memberAddress, status) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
  const tx = await router.updateMember(memberAddress, status);

  console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
  await tx.wait();

  console.log(`Updated member [${memberAddress}] to Router [${routerAddress}] with status [${status}]`);
}

module.exports = updateMember;