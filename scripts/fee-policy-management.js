const hardhat = require('hardhat')
const ethers = hardhat.ethers;

const { getSelectors } = require('../util');

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
    const FeePolicyFacet = await deployedFacet('FeePolicyFacet'); // Add

    console.log('RouterFacet address: ', RouterFacet.address);
    console.log('FeePolicyFacet address: ', FeePolicyFacet.address);

    console.log('Updating DiamondCut, please wait...');
    const router = await ethers.getContractAt('IRouterDiamond', routerAddress);

    const diamondCut = [
        { facetAddress: ethers.constants.AddressZero, action: enumFacetCutAction.Remove, functionSelectors: ['0xb258848a'] }, // lock(uint256,address,uint256,bytes)
        { facetAddress: RouterFacet.address, action: enumFacetCutAction.Replace, functionSelectors: [RouterFacet.interface.getSighash('unlock(uint256,bytes,address,uint256,address,bytes[])')] },
        { facetAddress: RouterFacet.address, action: enumFacetCutAction.Add, functionSelectors: [RouterFacet.interface.getSighash('unlockWithFee(uint256,bytes,address,uint256,address,uint256,bytes[])')] },
        { facetAddress: RouterFacet.address, action: enumFacetCutAction.Add, functionSelectors: [RouterFacet.interface.getSighash('feeAmountFor(uint256,address,address,uint256)')] },
        { facetAddress: RouterFacet.address, action: enumFacetCutAction.Add, functionSelectors: [RouterFacet.interface.getSighash('lock(uint256,address,uint256,bytes,uint256)')] },
        { facetAddress: RouterFacet.address, action: enumFacetCutAction.Add, functionSelectors: [RouterFacet.interface.getSighash('lockWithPermit(uint256,address,uint256,bytes,uint256,uint256,uint8,bytes32,bytes32)')] },
        { facetAddress: FeePolicyFacet.address, action: enumFacetCutAction.Add, functionSelectors: getSelectors(FeePolicyFacet) }
    ];

    const diamondCutTx = await router.diamondCut(diamondCut, ethers.constants.AddressZero, "0x");
    console.log(`Diamond Cut Replace with GovernanceV2Facet [${diamondCutTx.hash}] submitted, waiting to be mined...`);
    await diamondCutTx.wait();

    console.log('Verification, please wait...');
    await hardhat.run('verify:verify', { address: RouterFacet.address, constructorArguments: [] });
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

    const tx = await router.removeUsersFeePolicy(userAddresses);
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
