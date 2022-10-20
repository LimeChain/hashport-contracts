const hardhat = require('hardhat')
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

const enumFeeType = {
    Flat: 0,
    Percentage: 1
}

const enumFacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2
}

async function deployedFacet(facetName) {
    const facetFactory = await ethers.getContractFactory(facetName);
    facet = await facetFactory.deploy();
    console.log(`Deploying ${facetName}, please wait...`);
    await facet.deployed();

    return facet;
}

async function upgradeRouter(routerAddress) {
    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is being upgraded with FeePolicyFacet`);

    const RouterFacet = await deployedFacet('RouterFacet'); // Replace
    const FeeCalculatorFacet = await deployedFacet('FeeCalculatorFacet'); // Replace    
    const GovernanceFacet = await deployedFacet('GovernanceFacet'); // Replace
    const GovernanceV2Facet = await deployedFacet('GovernanceV2Facet'); // Replace
    const ERC721PortalFacet = await deployedFacet('ERC721PortalFacet'); // Replace
    const FeePolicyFacet = await deployedFacet('FeePolicyFacet'); // Add

    console.log('RouterFacet address: ', RouterFacet.address);
    console.log('FeeCalculatorFacet address: ', FeeCalculatorFacet.address);
    console.log('GovernanceFacet address: ', GovernanceFacet.address);
    console.log('GovernanceV2Facet address: ', GovernanceV2Facet.address);
    console.log('ERC721PortalFacet address: ', ERC721PortalFacet.address);
    console.log('FeePolicyFacet address: ', FeePolicyFacet.address);

    console.log('Updating DiamondCut, please wait...');
    const router = await ethers.getContractAt('IRouterDiamond', routerAddress);
    const diamondCut = [
        { facetAddress: RouterFacet.address, action: enumFacetCutAction.Replace, functionSelectors: getSelectors(RouterFacet) },
        { facetAddress: FeeCalculatorFacet.address, action: enumFacetCutAction.Replace, functionSelectors: getSelectors(FeeCalculatorFacet) },
        { facetAddress: GovernanceFacet.address, action: enumFacetCutAction.Replace, functionSelectors: getSelectors(GovernanceFacet) },
        { facetAddress: GovernanceV2Facet.address, action: enumFacetCutAction.Replace, functionSelectors: getSelectors(GovernanceV2Facet) },
        { facetAddress: ERC721PortalFacet.address, action: enumFacetCutAction.Replace, functionSelectors: getSelectors(ERC721PortalFacet) },
        { facetAddress: FeePolicyFacet.address, action: enumFacetCutAction.Add, functionSelectors: getSelectors(FeePolicyFacet) }
    ];

    const diamondCutTx = await router.diamondCut(diamondCut, ethers.constants.AddressZero, "0x");
    console.log(`Diamond Cut Replace with GovernanceV2Facet [${diamondCutTx.hash}] submitted, waiting to be mined...`);
    await diamondCutTx.wait();

    console.log('Verification, please wait...');
    await hardhat.run('verify:verify', { address: RouterFacet.address, constructorArguments: [] });
    await hardhat.run('verify:verify', { address: FeeCalculatorFacet.address, constructorArguments: [] });
    await hardhat.run('verify:verify', { address: GovernanceFacet.address, constructorArguments: [] });
    await hardhat.run('verify:verify', { address: GovernanceV2Facet.address, constructorArguments: [] });
    await hardhat.run('verify:verify', { address: ERC721PortalFacet.address, constructorArguments: [] });
    await hardhat.run('verify:verify', { address: FeePolicyFacet.address, constructorArguments: [] });
}

async function deployFlatFeePolicy(flatFee) {
    await hardhat.run('compile');

    const FlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');

    const FlatFeePolicy = await FlatFeePolicyFactory.deploy(flatFee);
    console.log('Deploying FlatFeePolicy, please wait...');

    await FlatFeePolicy.deployed();
    console.log('FlatFeePolicy address: ', FlatFeePolicy.address);

    console.log('Verification, please wait...');

    await hardhat.run('verify:verify', {
        address: FlatFeePolicy.address,
        constructorArguments: [flatFee]
    });
}

async function updateFlatFeePolicy(feePolicyAddress, flatFee) {
    await hardhat.run('compile');

    console.log(`Updating FlatFeePolicy at [${feePolicyAddress}] with flatFee of [${flatFee}]`);

    const feePolicy = await ethers.getContractAt('FlatFeePolicy', feePolicyAddress);
    await feePolicy.setFlatFee(flatFee);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}

async function deployPercentageFeePolicy(precision, feePercentage) {
    await hardhat.run('compile');

    const PercentageFeePolicyFactory = await ethers.getContractFactory('PercentageFeePolicy');

    const PercentageFeePolicy = await PercentageFeePolicyFactory.deploy(precision, feePercentage);
    console.log('Deploying PercentageFeePolicy, please wait...');

    await PercentageFeePolicy.deployed();
    console.log('PercentageFeePolicy address: ', PercentageFeePolicy.address);

    console.log('Verification, please wait...');

    await hardhat.run('verify:verify', {
        address: PercentageFeePolicy.address,
        constructorArguments: [precision, feePercentage]
    });
}

async function updatePercentageFeePolicy(feePolicyAddress, precision, feePercentage) {
    await hardhat.run('compile');

    const feePolicy = await ethers.getContractAt('PercentageFeePolicy', feePolicyAddress);

    if (precision > 0) {
        console.log(`Updating PercentageFeePolicy at [${feePolicyAddress}] with precision of [${precision}]`);
        await feePolicy.setPrecision(precision);
        console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
        console.log(`Finished with success`);
    }

    if (feePercentage > 0) {
        console.log(`Updating PercentageFeePolicy at [${feePolicyAddress}] with feePercentage of [${feePercentage}]`);
        await feePolicy.setFeePercentage(feePercentage);
        console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
        console.log(`Finished with success`);
    }
}

async function setUsersFeePolicy(routerAddress, feePolicyAddress, userAddresses) {
    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is setting addresses to IFeePolicy [${feePolicyAddress}]`);

    const router = await ethers.getContractAt('FeePolicyFacet', routerAddress);

    const tx = await router.setUsersFeePolicy(feePolicyAddress, userAddresses);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}

async function removeUsersFeePolicy(routerAddress, userAddresses) {
    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is removing addresses from fee policies`);

    const router = await ethers.getContractAt('FeePolicyFacet', routerAddress);

    const tx = await router.removeUsersFeePolicy(userAddresses);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}


module.exports = {
    upgradeRouter,
    deployFlatFeePolicy,
    updateFlatFeePolicy,
    deployPercentageFeePolicy,
    updatePercentageFeePolicy,
    setUsersFeePolicy,
    removeUsersFeePolicy
};