const hardhat = require('hardhat')
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

const enumFacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2
}

async function upgradeRouter(routerAddress, routerFacetAddress, feeCalculatorFacetAddress) {
    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is being upgraded with FeePolicyFacet(new), RouterFacet(replace), FeeCalculatorFacet(replace)`);

    const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

    const routerFacetSelectors = await router.facetFunctionSelectors(routerFacetAddress);
    const feeCalculatorFacetSelectors = await router.facetFunctionSelectors(feeCalculatorFacetAddress);

    // deploy facets
    const RouterFacetFactory = await ethers.getContractFactory('RouterFacet');
    const routerFacet = await RouterFacetFactory.deploy();
    await routerFacet.deployed();

    const FeeCalculatorFacetFactory = await ethers.getContractFactory('FeeCalculatorFacet');
    const feeCalculatorFacet = await FeeCalculatorFacetFactory.deploy();
    await feeCalculatorFacet.deployed();

    const FeePolicyFacetFactory = await ethers.getContractFactory('FeePolicyFacet');
    const feePolicyFacet = await FeePolicyFacetFactory.deploy();
    await feePolicyFacet.deployed();

    console.log('RouterFacet address: ', routerFacet.address);
    console.log('FeeCalculatorFacet address: ', feeCalculatorFacet.address);
    console.log('FeePolicyFacet address: ', feePolicyFacet.address);

    const diamondCut = [
        { facetAddress: ethers.constants.AddressZero, action: enumFacetCutAction.Remove, functionSelectors: routerFacetSelectors },
        { facetAddress: ethers.constants.AddressZero, action: enumFacetCutAction.Remove, functionSelectors: feeCalculatorFacetSelectors },
        { facetAddress: routerFacet.address, action: enumFacetCutAction.Add, functionSelectors: getSelectors(routerFacet) },
        { facetAddress: feeCalculatorFacet.address, action: enumFacetCutAction.Add, functionSelectors: getSelectors(feeCalculatorFacet) },
        { facetAddress: feePolicyFacet.address, action: enumFacetCutAction.Add, functionSelectors: getSelectors(feePolicyFacet) }
    ];

    const diamondCutTx = await router.diamondCut(diamondCut, ethers.constants.AddressZero, "0x");
    console.log(`Diamond Cut Upgrade [${diamondCutTx.hash}] submitted, waiting to be mined...`);
    await diamondCutTx.wait(10); // Wait 10 blocks before verification in case Etherscan nodes do not have the contract bytecode yet.

    console.log('Verification, please wait...');
    await hardhat.run('verify:verify', { address: routerFacet.address, constructorArguments: [] });
    await hardhat.run('verify:verify', { address: feeCalculatorFacet.address, constructorArguments: [] });
    await hardhat.run('verify:verify', { address: feePolicyFacet.address, constructorArguments: [] });
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

async function setFlatFeePolicy(feePolicyAddress, flatFee) {
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

async function setPercentageFeePolicy(feePolicyAddress, precision, feePercentage) {
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

async function deployFlatFeePerTokenPolicy() {
    await hardhat.run('compile');

    const FlatFeePerTokenPolicyFactory = await ethers.getContractFactory('FlatFeePerTokenPolicy');

    const FlatFeePerTokenPolicy = await FlatFeePerTokenPolicyFactory.deploy();
    console.log('Deploying FlatFeePerTokenPolicy, please wait...');

    await FlatFeePerTokenPolicy.deployed();
    console.log('FlatFeePerTokenPolicy address: ', FlatFeePerTokenPolicy.address);

    console.log('Verification, please wait...');

    await hardhat.run('verify:verify', {
        address: FlatFeePerTokenPolicy.address,
        constructorArguments: [flatFee]
    });
}

async function setFlatFeePerTokenPolicy(tokenAddress, flatFee) {
    await hardhat.run('compile');

    console.log(`Updating FlatFeePerTokenPolicy at [${feePolicyAddress}] with flatFee of [${flatFee}]`);

    const feePolicy = await ethers.getContractAt('FlatFeePerTokenPolicy', feePolicyAddress);
    await feePolicy.setFlatFee(tokenAddress, flatFee);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}

async function removeFlatFeePerTokenPolicy(tokenAddress) {
    await hardhat.run('compile');

    console.log(`Updating FlatFeePerTokenPolicy at [${feePolicyAddress}] with flatFee of [${flatFee}]`);

    const feePolicy = await ethers.getContractAt('FlatFeePerTokenPolicy', feePolicyAddress);
    await feePolicy.setFlatFee(tokenAddress);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
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

    const tx = await router.setUsersFeePolicy(ethers.constants.AddressZero, userAddresses);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}

module.exports = {
    upgradeRouter,
    deployFlatFeePolicy,
    setFlatFeePolicy,
    deployPercentageFeePolicy,
    setPercentageFeePolicy,
    deployFlatFeePerTokenPolicy,
    setFlatFeePerTokenPolicy,
    removeFlatFeePerTokenPolicy,
    setUsersFeePolicy,
    removeUsersFeePolicy
};
