const hardhat = require("hardhat");
const ethers = hardhat.ethers;

async function removeFacet(facetAddress, routerAddress) {
  const router = await ethers.getContractAt("IRouterDiamond", routerAddress);
  const functionSelectors = await router.facetFunctionSelectors(facetAddress);

  const diamondRemoveCut = [
    {
      facetAddress: ethers.constants.AddressZero,
      action: 2, // Remove
      functionSelectors: functionSelectors,
    },
  ];

  const tx = await router.diamondCut(
    diamondRemoveCut,
    ethers.constants.AddressZero,
    "0x"
  );

  console.log(`Facet removal transaction submitted: [${tx.hash}], waiting for transaction to be mined...`);
  await tx.wait();
}

module.exports = removeFacet;