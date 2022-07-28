const { AccountId } = require('@hashgraph/sdk');
const hardhat = require('hardhat');
const ethers = hardhat.ethers;

async function burnERC721(routerAddress, targetChain, wrappedAsset, tokenId, receiver) {
  await hardhat.run('compile');

  let receiverAddress = receiver;
  if (targetChain === '0' || targetChain === '295' || targetChain === '296') {
    receiverAddress = (AccountId.fromString(receiver)).toBytes();
  }

  const erc721PortalFacet = await ethers.getContractAt('ERC721PortalFacet', routerAddress);

  const paymentTokenAddress = await erc721PortalFacet.erc721Payment(wrappedAsset);
  console.log(`Bridge payment token for [${wrappedAsset}] is [${paymentTokenAddress}]`);

  const fee = await erc721PortalFacet.erc721Fee(wrappedAsset);
  console.log(`Bridge payment fee for [${wrappedAsset}] is [${fee}]`);

  const wrappedERC721 = await ethers.getContractAt('WrappedERC721', wrappedAsset);
  const paymentToken = await ethers.getContractAt('Token', paymentTokenAddress);

  const approveERC20Tx = await paymentToken.approve(routerAddress, fee);
  console.log(`Approve Router [${routerAddress}] for ERC-20 [${paymentTokenAddress}] for amount [${fee}]. Tx hash: [${approveERC20Tx.hash}]. Waiting to be mined...`);
  await approveERC20Tx.wait();

  const approveERC721Tx = await wrappedERC721.approve(routerAddress, tokenId);
  console.log(`Approve Router [${routerAddress}] for ERC-721 [${wrappedAsset}] for tokenId [${tokenId}]. Tx hash: [${approveERC721Tx.hash}]. Waiting to be mined...`);
  await approveERC721Tx.wait();


  const burnERC721Tx = await erc721PortalFacet.burnERC721(targetChain, wrappedAsset, tokenId, paymentTokenAddress, fee, receiverAddress);
  console.log(`Burn ERC-721 Portal transaction for [${wrappedAsset}], tokenId [${tokenId}]. Tx hash: [${burnERC721Tx.hash}]. Waiting to be mined...`);
  await burnERC721Tx.wait();
  console.log(`Tx [${burnERC721Tx.hash}] successfully mined.`);
}

module.exports = burnERC721;