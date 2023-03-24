const hardhat = require("hardhat");
const ethers = hardhat.ethers;
const { getSelectors } = require("../util");

async function updateFacet(facetName, facetAddress, routerAddress) {
  const facetContract = await ethers.getContractAt(facetName, facetAddress);

  const diamondAddCutReplace = [
    {
      facetAddress: facetContract.address,
      action: 1, // Replace
      functionSelectors: getSelectors(facetContract),
    },
  ];

  console.log(
    "\ndiamondAddCutReplace Data: \n",
    JSON.stringify(diamondAddCutReplace)
  );

  const router = await ethers.getContractAt("IRouterDiamond", routerAddress);
  const txData = router.interface.encodeFunctionData("diamondCut", [
    diamondAddCutReplace,
    ethers.constants.AddressZero,
    "0x",
  ]);

  console.log("\nTX Data: \n");
  console.log(txData);
}

module.exports = updateFacet;