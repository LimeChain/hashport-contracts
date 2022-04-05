const hardhat = require('hardhat');
const ethers = hardhat.ethers;

async function transferOwnership(contract, newOwner) {
  await hardhat.run('compile');

  const diamond = await ethers.getContractAt("IERC173", contract);

  const diamondTransferOwnersihp = await diamond.transferOwnership(newOwner);
  console.log(`Transfer Ownership [${diamondTransferOwnersihp.hash}] submitted, waiting to be mined...`);
  await diamondTransferOwnersihp.wait();
}

module.exports = transferOwnership;