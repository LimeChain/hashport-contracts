const hardhat = require('hardhat');
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

async function upgradeFeeCalculatorFacet(routerAddress) {
  const contracts = await performUpgradeFeeCalculatorFacet(routerAddress);

  console.log('\n=== Verifying Contracts ===');
  for (const contract of contracts) {
    try {
      await hardhat.run('verify:verify', {
        address: contract.address,
        constructorArguments: contract.args
      });
      console.log(`${contract.title} verified`);
    } catch (error) {
      if (error.message.includes('Already Verified')) {
        console.log(`${contract.title} already verified`);
      } else {
        console.error(`Failed to verify ${contract.title}:`, error.message);
      }
    }
  }
}

async function performUpgradeFeeCalculatorFacet(routerAddress) {
  const result = [];

  console.log('\n=== Upgrading FeeCalculatorFacet ===');
  console.log('Router Address:', routerAddress);

  await hardhat.run('compile');

  // Deploy new FeeCalculatorFacet with gas cost functions
  const feeCalculatorFacetFactory = await ethers.getContractFactory('FeeCalculatorFacet');
  const feeCalculatorFacet = await feeCalculatorFacetFactory.deploy();
  console.log('Deploying FeeCalculatorFacet, please wait...');
  await feeCalculatorFacet.deployed();
  console.log('FeeCalculatorFacet address:', feeCalculatorFacet.address);
  result.push({ title: 'FeeCalculatorFacet', address: feeCalculatorFacet.address, args: [] });

  const allFunctionSelectors = getSelectors(feeCalculatorFacet);
  console.log(`\nTotal function selectors in new facet: ${allFunctionSelectors.length}`);

  const newGasCostSelectors = [
    feeCalculatorFacet.interface.getSighash('setUnlockGasCost(uint256)'),
    feeCalculatorFacet.interface.getSighash('setMintGasCost(uint256)'),
    feeCalculatorFacet.interface.getSighash('unlockGasCost()'),
    feeCalculatorFacet.interface.getSighash('mintGasCost()')
  ];

  const existingFunctionSelectors = allFunctionSelectors.filter(
    selector => !newGasCostSelectors.includes(selector)
  );

  console.log(`Existing functions to replace: ${existingFunctionSelectors.length}`);
  console.log(`New functions to add: ${newGasCostSelectors.length}`);

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

  console.log('\n=== Executing Diamond Cut (Replace Existing Functions) ===');
  
  // Replace existing FeeCalculatorFacet functions
  const diamondReplaceCut = [{
    facetAddress: feeCalculatorFacet.address,
    action: 1, // Replace
    functionSelectors: existingFunctionSelectors
  }];

  const diamondReplaceTx = await router.diamondCut(
    diamondReplaceCut,
    ethers.constants.AddressZero,
    "0x"
  );
  console.log(`Diamond Cut Replace [${diamondReplaceTx.hash}] submitted, waiting to be mined...`);
  await diamondReplaceTx.wait();
  console.log('✓ Existing functions replaced!');

  console.log('\n=== Executing Diamond Cut (Add New Functions) ===');
  
  // Add new gas cost functions
  const diamondAddCut = [{
    facetAddress: feeCalculatorFacet.address,
    action: 0, // Add
    functionSelectors: newGasCostSelectors
  }];

  const diamondAddTx = await router.diamondCut(
    diamondAddCut,
    ethers.constants.AddressZero,
    "0x"
  );
  console.log(`Diamond Cut Add [${diamondAddTx.hash}] submitted, waiting to be mined...`);
  await diamondAddTx.wait();
  console.log('New gas cost functions added!');

  console.log('\n=== Upgrade Complete ===');
  console.log('Summary:');
  console.log('- New FeeCalculatorFacet deployed at:', feeCalculatorFacet.address);
  console.log('- All FeeCalculatorFacet functions updated on router:', routerAddress);
  console.log('- New functions available: setUnlockGasCost, setMintGasCost, unlockGasCost, mintGasCost');

  return result;
}

module.exports = { upgradeFeeCalculatorFacet, performUpgradeFeeCalculatorFacet };
