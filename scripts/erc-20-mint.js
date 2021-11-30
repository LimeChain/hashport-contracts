const hardhat = require('hardhat');
const ethers = hardhat.ethers;

const hexPrefix = '0x';

async function mintERC20(routerAddress, sourceChain, targetChain, transactionId, wrappedAsset, receiver, amount, signatures) {
  await hardhat.run('compile');

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

  const evmTransactionId = ethers.utils.toUtf8Bytes(transactionId);

  const hexSignatures = [];
  for (let signature of signatures) {
    if (!signature.startsWith(hexPrefix)) {
      signature = hexPrefix + signature
    }
    hexSignatures.push(signature);
  }

  const encodeData = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256', 'bytes', 'address', 'address', 'uint256'],
    [sourceChain, targetChain, evmTransactionId, wrappedAsset, receiver, amount]);
  const hashMsg = ethers.utils.keccak256(encodeData);
  const hashData = ethers.utils.arrayify(hashMsg);
  const hash = ethers.utils.hashMessage(hashData);

  const isUsed = await router.hashesUsed(hash);

  if (isUsed) {
    console.log(`Transaction [${transactionId}] already submitted.`);
    return;
  }

  const tx = await router.mint(
    sourceChain,
    evmTransactionId,
    wrappedAsset,
    receiver,
    amount,
    hexSignatures
  );

  console.log(`Mint ERC-20 transaction submitted: [${tx.hash}], waiting for transaction to be mined...`);
  await tx.wait();
}

module.exports = mintERC20;