const hardhat = require('hardhat');
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

async function upgradeGovernanceV3(routerAddress) {

  const contracts = await performUpgradeGovernanceV3(routerAddress);

  for (const contract of contracts) {
    await hardhat.run('verify:verify', {
      address: contract.address,
      constructorArguments: contract.args
    });
  }
}

async function performUpgradeGovernanceV3(routerAddress) {
  const result = [];

  await hardhat.run('compile');

  const governanceV3FacetFactory = await ethers.getContractFactory('GovernanceFacetV3');
  const governanceV3Facet = await governanceV3FacetFactory.deploy();
  console.log('Deploying GovernanceFacetV3, please wait...');
  await governanceV3Facet.deployed();
  console.log('GovernanceFacetV3 address: ', governanceV3Facet.address);
  result.push({ title: 'GovernanceFacetV3', address: governanceV3Facet.address, args: [] });

  const feeDistributorFacetFactory = await ethers.getContractFactory('FeeDistributorFacet');
  const feeDistributorFacet = await feeDistributorFacetFactory.deploy();
  console.log('Deploying FeeDistributorFacet, please wait...');
  await feeDistributorFacet.deployed();
  console.log('FeeDistributorFacet address: ', feeDistributorFacet.address);
  result.push({ title: 'FeeDistributorFacet', address: feeDistributorFacet.address, args: [] });

  const routerFacetV2Factory = await ethers.getContractFactory('RouterFacetV2');
  const routerFacetV2 = await routerFacetV2Factory.deploy();
  console.log('Deploying RouterFacetV2, please wait...');
  await routerFacetV2.deployed();
  console.log('RouterFacetV2 address: ', routerFacetV2.address);
  result.push({ title: 'RouterFacetV2', address: routerFacetV2.address, args: [] });

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

  const newUpdateNativeTokenSelector = routerFacetV2.interface.getSighash('updateNativeToken(address,bool)');
  const oldUpdateNativeTokenSelector = ethers.utils.id('updateNativeToken(address,uint256,bool)').slice(0, 10);

  const routerV2ReplaceSelectors = getSelectors(routerFacetV2).filter(
    s => s !== newUpdateNativeTokenSelector
  );

  const diamondCut = [
    {
      facetAddress: governanceV3Facet.address,
      action: 1, // Replace
      functionSelectors: getSelectors(governanceV3Facet),
    },
    {
      facetAddress: feeDistributorFacet.address,
      action: 0, // Add
      functionSelectors: getSelectors(feeDistributorFacet),
    },
    {
      facetAddress: routerFacetV2.address,
      action: 1, // Replace
      functionSelectors: routerV2ReplaceSelectors,
    },
    {
      facetAddress: ethers.constants.AddressZero,
      action: 2, // Remove
      functionSelectors: [oldUpdateNativeTokenSelector],
    },
    {
      facetAddress: routerFacetV2.address,
      action: 0, // Add
      functionSelectors: [newUpdateNativeTokenSelector],
    },
  ];

  const initCalldata = feeDistributorFacet.interface.encodeFunctionData('initFeeDistributor');

  const diamondCutTx = await router.diamondCut(diamondCut, feeDistributorFacet.address, initCalldata);
  console.log(`Diamond Cut Replace GovernanceV3 + RouterV2 + Add FeeDistributor [${diamondCutTx.hash}] submitted, waiting to be mined...`);
  await diamondCutTx.wait();

  return result;
}

module.exports = { upgradeGovernanceV3, performUpgradeGovernanceV3 };
