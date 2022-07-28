const { AccountId } = require('@hashgraph/sdk');
const hardhat = require('hardhat');
const ethers = hardhat.ethers;

async function burnERC20(routerAddress, targetChain, wrappedAsset, amount, receiver) {
  await hardhat.run('compile');

  let receiverAddress = receiver;
  if (targetChain === '0' || targetChain === '295' || targetChain === '296') {
    receiverAddress = (AccountId.fromString(receiver)).toBytes();
  }

  const routerContract = await ethers.getContractAt('IRouter', routerAddress);
  const wrappedToken = await ethers.getContractAt('WrappedToken', wrappedAsset);

  const approveERC20Tx = await wrappedToken.approve(routerAddress, amount);
  console.log(`Approve Router [${routerAddress}] for ERC-20 [${wrappedAsset}] for amount [${amount}]. Tx hash: [${approveERC20Tx.hash}]. Waiting to be mined...`);
  await approveERC20Tx.wait();

  const burnERC20Tx = await routerContract.burn(targetChain, wrappedAsset, amount, receiverAddress);
  console.log(`Burn ERC-20 Portal transaction for [${wrappedAsset}], amount [${amount}], receiver [${receiverAddress} - ${receiver}]. Tx hash: [${burnERC20Tx.hash}]. Waiting to be mined...`);
  await burnERC20Tx.wait();
  console.log(`Tx [${burnERC20Tx.hash}] successfully mined.`);
}

module.exports = burnERC20;