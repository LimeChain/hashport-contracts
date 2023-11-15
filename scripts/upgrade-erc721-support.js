const hardhat = require('hardhat');
const ethers = hardhat.ethers;
const { Wallet, utils } =  require("zksync-web3");
const { Deployer } =  require( "@matterlabs/hardhat-zksync-deploy");

const { getSelectors } = require('../util');

async function upgradeErc721Support(routerAddress) {

  const contracts = await performUpgradeErc721Support(routerAddress);

  for (const contract in contracts) {
    await hardhat.run('verify:verify', {
      address: contract.address,
      constructorArguments: contract.args
    });
  }
}

async function performUpgradeErc721Support(routerAddress) {
  const result = []; // {title:'', address: '', args: null}

  await hardhat.run('compile');

  const wallet = new Wallet(`0x${hardhat.config.privateKey}`);
  const deployer = new Deployer(hre, wallet);
  const paymentFacetFactory = await deployer.loadArtifact('PaymentFacet');
  const paymentFacet = await deployer.deploy(paymentFacetFactory, []); //paymentFacetFactory.deploy();
  console.log('Deploying PaymentFacet, please wait...');
  await paymentFacet.deployed();
  console.log('PaymentFacet address: ', paymentFacet.address);
  result.push({ title: 'PaymentFacet', address: paymentFacet.address, args: [] });

  const erc721PortalFacetFactory = await deployer.loadArtifact('ERC721PortalFacet');
  const erc721PortalFacet = await deployer.deploy(erc721PortalFacetFactory, []); //await erc721PortalFacetFactory.deploy();
  console.log('Deploying ERC-721 Portal Facet, please wait...');
  await erc721PortalFacet.deployed();
  console.log('ERC-721 Portal Facet address: ', erc721PortalFacet.address);
  result.push({ title: 'ERC721PortalFacet', address: erc721PortalFacet.address, args: [] });

  const governanceV2FacetFactory = await deployer.loadArtifact('GovernanceV2Facet');
  const governanceV2Facet = await deployer.deploy(governanceV2FacetFactory, []); //await governanceV2FacetFactory.deploy();
  console.log('Deploying GovernanceV2Facet, please wait...');
  await governanceV2Facet.deployed();
  console.log('GovernanceV2Facet address: ', governanceV2Facet.address);
  result.push({ title: 'GovernanceV2Facet', address: governanceV2Facet.address, args: [] });

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

  const diamondReplaceCutGovernanceV2 = [{
    facetAddress: governanceV2Facet.address,
    action: 1, // Replace
    functionSelectors: getSelectors(governanceV2Facet)
  }];

  const diamondReplaceWithGovernanceV2Tx = await router.diamondCut(diamondReplaceCutGovernanceV2, ethers.constants.AddressZero, "0x");
  console.log(`Diamond Cut Replace with GovernanceV2Facet [${diamondReplaceWithGovernanceV2Tx.hash}] submitted, waiting to be mined...`);
  await diamondReplaceWithGovernanceV2Tx.wait();

  // Diamond cut to add Payment Facet
  const diamondAddCutPayment = [{
    facetAddress: paymentFacet.address,
    action: 0, // Add
    functionSelectors: getSelectors(paymentFacet),
  }];

  const diamondAddPaymentTx = await router.diamondCut(diamondAddCutPayment, ethers.constants.AddressZero, "0x");
  console.log(`Diamond Cut Add PaymentFacet [${diamondAddPaymentTx.hash}] submitted, waiting to be mined...`);
  await diamondAddPaymentTx.wait();

  // Diamond cut to add ERC-721 Portal Facet
  const diamondAddCutERC721Portal = [{
    facetAddress: erc721PortalFacet.address,
    action: 0, // Add
    functionSelectors: getSelectors(erc721PortalFacet),
  }];

  const diamondAddERC721PortalTx = await router.diamondCut(diamondAddCutERC721Portal, ethers.constants.AddressZero, "0x");
  console.log(`Diamond Cut Add ERC-721 Portal [${diamondAddERC721PortalTx.hash}] submitted, waiting to be mined...`);
  await diamondAddERC721PortalTx.wait();

  return result;
}

module.exports = { upgradeErc721Support, performUpgradeErc721Support };