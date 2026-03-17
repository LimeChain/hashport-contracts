const hardhat = require('hardhat');
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

async function upgradeGovernanceV2(routerAddress) {

  const contracts = await performUpgradeGovernanceV2(routerAddress);

  for (const contract of contracts) {
    await hardhat.run('verify:verify', {
      address: contract.address,
      constructorArguments: contract.args
    });
  }
}

async function performUpgradeGovernanceV2(routerAddress) {
  const result = [];

  await hardhat.run('compile');

  const governanceV2FacetFactory = await ethers.getContractFactory('GovernanceV2Facet');
  const governanceV2Facet = await governanceV2FacetFactory.deploy();
  console.log('Deploying GovernanceV2Facet, please wait...');
  await governanceV2Facet.deployed();
  console.log('GovernanceV2Facet address: ', governanceV2Facet.address);
  result.push({ title: 'GovernanceV2Facet', address: governanceV2Facet.address, args: [] });

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

  const diamondCut = [
    {
      facetAddress: governanceV2Facet.address,
      action: 1, // Replace
      functionSelectors: getSelectors(governanceV2Facet),
    },
  ];

  const diamondCutTx = await router.diamondCut(diamondCut, ethers.constants.AddressZero, "0x");
  console.log(`Diamond Cut Replace GovernanceV2 [${diamondCutTx.hash}] submitted, waiting to be mined...`);
  await diamondCutTx.wait();

  return result;
}

module.exports = { upgradeGovernanceV2, performUpgradeGovernanceV2 };
