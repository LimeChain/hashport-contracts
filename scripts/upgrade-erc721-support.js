const hardhat = require('hardhat')
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

const updatedFunction = 'updateMember(address,address,bool)';

async function upgradeErc721Support(routerAddress) {
  await hardhat.run('compile');

  const paymentFacetFactory = await ethers.getContractFactory('PaymentFacet');
  const paymentFacet = await paymentFacetFactory.deploy();
  console.log('Deploying PaymentFacet, please wait...');
  await paymentFacet.deployed();
  console.log('PaymentFacet address: ', paymentFacet.address);

  const erc721PortalFacetFactory = await ethers.getContractFactory('ERC721PortalFacet');
  const erc721PortalFacet = await erc721PortalFacetFactory.deploy();
  console.log('Deploying ERC-721 Portal Facet, please wait...');
  await erc721PortalFacet.deployed();
  console.log('ERC-721 Portal Facet address: ', erc721PortalFacet.address);

  const governanceFacet = await ethers.getContractAt('GovernanceFacet', null);
  const sigHash = await governanceFacet.interface.getSighash(updatedFunction);

  const diamondRemoveCut = [{
    facetAddress: ethers.constants.AddressZero,
    action: 2, // Remove
    functionSelectors: [sigHash]
  }];

  const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
  const diamondRemoveTx = await router.diamondCut(diamondRemoveCut, ethers.constants.AddressZero, "0x");
  console.log(`Diamond Cut updateMember removal [${diamondRemoveTx.hash}] submitted, waiting to be mined...`);
  await diamondRemoveTx.wait();

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
}

module.exports = upgradeErc721Support;