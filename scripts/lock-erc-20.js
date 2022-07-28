const { AccountId } = require('@hashgraph/sdk');
const hardhat = require('hardhat');
const ethers = hardhat.ethers;

async function lockERC20(routerAddress, targetChain, nativeAsset, amount, receiver) {
  await hardhat.run('compile');

  let receiverAddress = receiver;
  if (targetChain === '0' || targetChain === '295' || targetChain === '296') {
    receiverAddress = (AccountId.fromString(receiver)).toBytes();
  }

  const routerContract = await ethers.getContractAt('IRouter', routerAddress);
  const nativeToken = await ethers.getContractAt('Token', nativeAsset);

  const approveERC20Tx = await nativeToken.approve(routerAddress, amount);
  console.log(`Approve Router [${routerAddress}] for ERC-20 [${nativeAsset}] for amount [${amount}]. Tx hash: [${approveERC20Tx.hash}]. Waiting to be mined...`);
  await approveERC20Tx.wait();

  const lockERC20Tx = await routerContract.lock(targetChain, nativeAsset, amount, receiverAddress);
  console.log(`Lock ERC-20 Portal transaction for [${nativeAsset}], amount [${amount}]. Tx hash: [${lockERC20Tx.hash}]. Waiting to be mined...`);
  await lockERC20Tx.wait();
  console.log(`Tx [${lockERC20Tx.hash}] successfully mined.`);
}

module.exports = lockERC20;