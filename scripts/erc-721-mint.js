const hardhat = require('hardhat');
const ethers = hardhat.ethers;

const hexPrefix = '0x';

async function mintERC721(routerAddress, sourceChain, targetChain, transactionId, wrappedToken, tokenId, metadata, receiver, signatures) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
  const erc721PortalFacet = await ethers.getContractAt('ERC721PortalFacet', routerAddress);

  const evmTransactionId = ethers.utils.toUtf8Bytes(transactionId);

  const hexSignatures = [];
  for (let signature of signatures) {
    if (!signature.startsWith(hexPrefix)) {
      signature = hexPrefix + signature
    }
    hexSignatures.push(signature);
  }

  const encodeData = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
    [sourceChain, targetChain, evmTransactionId, wrappedToken, tokenId, metadata, receiver]);
  const hashMsg = ethers.utils.keccak256(encodeData);
  const hashData = ethers.utils.arrayify(hashMsg);
  const hash = ethers.utils.hashMessage(hashData);

  const isUsed = await router.hashesUsed(hash);

  if (isUsed) {
    console.log(`Transaction [${transactionId}] already submitted.`);
    return;
  }

  const tx = await erc721PortalFacet.mintERC721(
    sourceChain,
    evmTransactionId,
    wrappedToken,
    tokenId,
    metadata,
    receiver,
    hexSignatures
  );

  console.log(`Mint ERC-721 transaction submitted: [${tx.hash}], waiting for transaction to be mined...`);
  await tx.wait();
}

module.exports = mintERC721;