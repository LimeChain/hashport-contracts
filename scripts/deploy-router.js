const hardhat = require('hardhat');
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

const { performUpgradeErc721Support } = require('./upgrade-erc721-support');

async function deployRouter(owner, governancePercentage, governancePrecision, feeCalculatorPrecision, members, membersAdmins) {
  await hardhat.run('compile');

  const routerFacetFactory = await ethers.getContractFactory('RouterFacet');
  routerFacet = await routerFacetFactory.deploy();
  console.log('Deploying RouterFacet, please wait...');
  await routerFacet.deployed();

  const ownershipFacetFactory = await ethers.getContractFactory('OwnershipFacet');
  ownershipFacet = await ownershipFacetFactory.deploy();
  console.log('Deploying OwnershipFacet, please wait...');
  await ownershipFacet.deployed();

  const feeCalculatorFacetFactory = await ethers.getContractFactory('FeeCalculatorFacet');
  feeCalculatorFacet = await feeCalculatorFacetFactory.deploy();
  console.log('Deploying FeeCalculatorFacet, please wait...');
  await feeCalculatorFacet.deployed();

  const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
  governanceFacet = await governanceFacetFactory.deploy();
  console.log('Deploying GovernanceFacet, please wait...');
  await governanceFacet.deployed();

  const diamondCutFacetFactory = await ethers.getContractFactory('DiamondCutFacet');
  cutFacet = await diamondCutFacetFactory.deploy();
  console.log('Deploying DiamondCutFacet, please wait...');
  await cutFacet.deployed();

  const diamondLoupeFacetFactory = await ethers.getContractFactory('DiamondLoupeFacet');
  loupeFacet = await diamondLoupeFacetFactory.deploy();
  console.log('Deploying DiamondLoupeFacet, please wait...');
  await loupeFacet.deployed();

  const pausableFacetFactory = await ethers.getContractFactory('PausableFacet');
  pausableFacet = await pausableFacetFactory.deploy();
  console.log('Deploying PausableFacet, please wait...');
  await pausableFacet.deployed();

  const diamondCut = [
    // 0 stands for FacetCutAction.Add
    [cutFacet.address, 0, getSelectors(cutFacet)],
    [loupeFacet.address, 0, getSelectors(loupeFacet)],
    [feeCalculatorFacet.address, 0, getSelectors(feeCalculatorFacet)],
    [governanceFacet.address, 0, getSelectors(governanceFacet)],
    [ownershipFacet.address, 0, getSelectors(ownershipFacet)],
    [routerFacet.address, 0, getSelectors(routerFacet)],
    [pausableFacet.address, 0, getSelectors(pausableFacet)],
  ];

  const args = [
    owner
  ];

  const diamondFactory = await ethers.getContractFactory('Router');
  diamond = await diamondFactory.deploy(diamondCut, args);
  console.log('Deploying Router, please wait...');
  await diamond.deployed();

  router = await ethers.getContractAt('IRouterDiamond', diamond.address);

  console.log(`Initializing Governance with 
              members [${members}],
              membersAdmins [${membersAdmins}],
              percentage [${governancePercentage}] and
              precision [${governancePrecision}], please wait...`);
  const initGovernanceTx = await (await router.initGovernance(members, membersAdmins, governancePercentage, governancePrecision));
  await initGovernanceTx.wait();

  console.log(`Initializing Router, please wait...`);
  const initRouterTx = await (await router.initRouter());
  await initRouterTx.wait();
  console.log(`Initializing Fee Calculator with precision [${feeCalculatorPrecision}], please wait...`);
  const initFeeCalculatorTx = await (await router.initFeeCalculator(feeCalculatorPrecision));
  await initFeeCalculatorTx.wait();

  console.log('Router address: ', diamond.address);
  console.log('OwnershipFacet address: ', ownershipFacet.address);
  console.log('GovernanceFacet address: ', governanceFacet.address);
  console.log('RouterFacet address: ', routerFacet.address);
  console.log('FeeCalculatorFacet address: ', feeCalculatorFacet.address);
  console.log('DiamondCutFacet address: ', cutFacet.address);
  console.log('DiamondLoupeFacet address: ', loupeFacet.address);
  console.log('PausableFacet address: ', pausableFacet.address);

  console.log('Upgrade router');
  const upgradeContratItems = await performUpgradeErc721Support(diamond.address);

  console.log('Verification, please wait...');

  await hardhat.run('verify:verify', {
    address: routerFacet.address,
    constructorArguments: []
  });

  await hardhat.run('verify:verify', {
    address: ownershipFacet.address,
    constructorArguments: []
  });

  await hardhat.run('verify:verify', {
    address: feeCalculatorFacet.address,
    constructorArguments: []
  });

  await hardhat.run('verify:verify', {
    address: governanceFacet.address,
    constructorArguments: []
  });

  await hardhat.run('verify:verify', {
    address: cutFacet.address,
    constructorArguments: []
  });

  await hardhat.run('verify:verify', {
    address: loupeFacet.address,
    constructorArguments: []
  });

  await hardhat.run('verify:verify', {
    address: pausableFacet.address,
    constructorArguments: []
  });

  await hardhat.run('verify:verify', {
    address: diamond.address,
    constructorArguments: [diamondCut, args]
  });

  for (const contract in upgradeContratItems) {
    await hardhat.run('verify:verify', {
      address: contract.address,
      constructorArguments: contract.args
    });
  }
}

module.exports = deployRouter;