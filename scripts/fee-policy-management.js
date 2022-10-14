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

async function deployPolicyStore(routerAddress, userAddresses) {
    await hardhat.run('compile');

    const entityFeePolicyStoreFactory = await ethers.getContractFactory('EntityFeePolicyStore');
    const entityFeePolicyStore = await entityFeePolicyStoreFactory.deploy();
    console.log('Deploying EntityFeePolicyStore, please wait...');
    await entityFeePolicyStore.deployed();
    console.log('EntityFeePolicyStore address: ', entityFeePolicyStore.address);

    console.log(`Transferring ownership to [${routerAddress}], please wait...`);
    const tx = await entityFeePolicyStore.transferOwnership(routerAddress);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    //await tx.wait(10);

    const entityFeePolicyStoreOwner = await entityFeePolicyStore.owner();
    console.log(`Successfully transferred ownership to [${entityFeePolicyStoreOwner}].`);

    console.log('Verification, please wait...');

    // Verification
    await hardhat.run('verify:verify', {
        address: entityFeePolicyStore.address,
        constructorArguments: []
    });

    if (userAddresses.length > 0) {
        await addFeePolicyUsers(routerAddress, entityFeePolicyStore.address, userAddresses);
    }
}

async function addFeePolicyUsers(routerAddress, storeAddress, userAddresses) {
    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is setting addresses to store [${storeAddress}]`);
    console.log('User addresses', userAddresses);

    const router = await ethers.getContractAt('FeePolicyFacet', routerAddress);

    const tx = await router.addFeePolicyUsers(storeAddress, userAddresses);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}

async function removeFeePolicyUsers(routerAddress, storeAddress, userAddresses) {
    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is setting addresses to store [${storeAddress}]`);

    const router = await ethers.getContractAt('FeePolicyFacet', routerAddress);

    const tx = await router.removeFeePolicyUsers(storeAddress, userAddresses);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}

async function setTokenFeePolicy(routerAddress, storeAddress, tokenAddress, policiesStr) {
    // expected policiesStr in format `feeType|amountFrom|amountTo|feeValue;feeType|amountFrom|amountTo|feeValue`
    // to be converted to
    // policies: [
    //     { feeType: 0 /* Flat */, amountFrom: null, amountTo: 1000, feeValue: 30 },
    //     { feeType: 0 /* Flat */, amountFrom: 1000, amountTo: 2000, feeValue: 20 },
    //     { feeType: 0 /* Flat */, amountFrom: 2000, amountTo: null, feeValue: 10 }
    // ]

    const policies = [];
    const policyLines = policiesStr.split(';');

    for (const line of policyLines) {
        const pair = line.split('|');
        let feeType = undefined;

        switch (pair[0]) {
            case 'flat':
                feeType = enumFeeType.Flat;
                break;
            case 'percentage':
                feeType = enumFeeType.Percentage;
                break;
            default:
                throw new Error(`Inalid fee type [${pair[0]}]`);
                break;
        }

        policies.push({
            feeType: feeType,
            amountFrom: parseInt(pair[1]) || null,
            amountTo: parseInt(pair[2]) || null,
            feeValue: parseInt(pair[3]) || null
        });
    }

    console.log('policies', policies);

    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is setting fee policies to store [${storeAddress}] for token [${tokenAddress}]`);

    const router = await ethers.getContractAt('FeePolicyFacet', routerAddress);

    let tx = null;
    let policyStr = '';

    if (policies.length == 1) {
        const policy = policies[0];
        policyStr = `${policy.feeType} from ${policy.amountFrom} to ${policy.amountTo}: ${policy.feeValue}`;

        switch (policy.feeType) {
            case enumFeeType.Flat:
                tx = await router.setFlatFeeTokenPolicy(storeAddress, tokenAddress, policy.feeValue);
                console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
                await tx.wait();

                console.log(`${policyStr} : SET`);
                break;
            case enumFeeType.Percentage:
                tx = await router.setPercentageFeeTokenPolicy(storeAddress, tokenAddress, policy.feeValue);
                console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
                await tx.wait();

                console.log(`${policyStr} : SET`);
                break;
            default:
                console.error(`${policyStr} : ERROR - invalid feeType`);
                break;
        }
    }
    else {
        let valid = true;

        const feeTypeArr = [];
        const amountFromArr = [];
        const amountToArr = [];
        const hasFromArr = [];
        const hasToArr = [];
        const feeValueArr = [];

        for (let i = 0; i < policies.length; i++) {
            const policy = policies[i];

            policyStr += `${policy.feeType} from ${policy.amountFrom} to ${policy.amountTo}: ${policy.feeValue}` + ';';

            valid = valid
                && (policy.feeType == enumFeeType.Flat || policy.feeType == enumFeeType.Percentage)
                && (
                    (policy.amountFrom == null && policy.amountTo > 0)
                    || (policy.amountFrom >= 0 && policy.amountTo == null)
                    || (policy.amountFrom >= 0 && policy.amountTo > 0 && policy.amountFrom <= policy.amountTo)
                )
                && policy.feeValue > 0;

            switch (policy.feeType) {
                case enumFeeType.Flat:
                    tx = await router.setFlatFeeTokenPolicy(storeAddress, tokenAddress, policy.feeValue);
                    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
                    await tx.wait();

                    console.log(`${policyStr} : SET`);
                    break;
                case enumFeeType.Percentage:
                    tx = await router.setPercentageFeeTokenPolicy(storeAddress, tokenAddress, policy.feeValue);
                    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
                    await tx.wait();

                    console.log(`${policyStr} : SET`);
                    break;
                default:
                    console.error(`${policyStr} : ERROR - invalid feeType`);
                    break;
            }

            feeTypeArr[i] = policy.feeType;
            amountFromArr[i] = policy.amountFrom || 0;
            amountToArr[i] = policy.amountTo || 0;
            hasFromArr[i] = policy.amountFrom !== null;
            hasToArr[i] = policy.amountTo !== null;
            feeValueArr[i] = policy.feeValue;
        }

        if (!valid) {
            console.error(`${policyStr} : ERROR - unable to parse policies`);
            throw new Error("Error while parsing policies");
        }

        tx = await router.setTiersTokenPolicy(
            storeAddress,
            tokenAddress,
            feeTypeArr,
            amountFromArr,
            amountToArr,
            hasFromArr,
            hasToArr,
            feeValueArr
        );

        console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
        await tx.wait();

        console.log(`${policyStr} : SET`);
    }

    console.log(`Finished`);
}

async function removeTokenFeePolicy(routerAddress, storeAddress, tokenAddress) {
    await hardhat.run('compile');

    console.log(`Router at [${routerAddress}] is removing fee policies to store [${storeAddress}] for token [${tokenAddress}]`);

    const router = await ethers.getContractAt('FeePolicyFacet', routerAddress);

    const tx = await router.removeTokenFeePolicy(storeAddress, tokenAddress);
    console.log(`TX [${tx.hash}] submitted, waiting to be mined...`);
    console.log(`Finished with success`);
}

module.exports = { upgradeRouter, deployPolicyStore, addFeePolicyUsers, removeFeePolicyUsers, setTokenFeePolicy, removeTokenFeePolicy };