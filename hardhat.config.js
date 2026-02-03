const { task, types } = require('hardhat/config');

const ALCHEMY_PROJECT_ID = process.env.ALCHEMY_PROJECT_ID || '';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomicfoundation/hardhat-verify");
require('@nomiclabs/hardhat-waffle');
require('solidity-coverage');
require('hardhat-gas-reporter');

task('deploy-router', 'Deploys Router contract will all the necessary facets')
    .addParam('owner', 'The owner of the to-be deployed router')
    .addParam('governancePercentage', 'The percentage of how many of the total members are required to sign given message', 50, types.int)
    .addParam('governancePrecision', 'The precision of division of required members signatures', 100, types.int)
    .addParam('feeCalculatorPrecision', 'The precision of fee calculations for native tokens', 100_000, types.int)
    .addParam('members', 'The addresses of the members')
    .addParam('membersAdmins', 'The addresses of the members\' admins')
    .setAction(async (taskArgs) => {
        const deployRouter = require('./scripts/deploy-router');
        const membersArray = taskArgs.members.split(',');
        const membersAdminsArray = taskArgs.membersAdmins.split(',');
        await deployRouter(
            taskArgs.owner,
            taskArgs.governancePercentage,
            taskArgs.governancePrecision,
            taskArgs.feeCalculatorPrecision,
            membersArray,
            membersAdminsArray);
    });

task('deploy-token', 'Deploys token to the provided network')
    .addParam('name', 'The token name')
    .addParam('symbol', 'The token symbol')
    .addParam('decimals', 'The token decimals', 18, types.int)
    .setAction(async (taskArgs) => {
        const deployToken = require('./scripts/deploy-token');
        await deployToken(taskArgs.name, taskArgs.symbol, taskArgs.decimals);
    });

task('deploy-wrapped-token', 'Deploys wrapped token to the provided network')
    .addParam('name', 'The token name')
    .addParam('symbol', 'The token symbol')
    .addParam('decimals', 'The token decimals', 18, types.int)
    .setAction(async (taskArgs) => {
        const deployWrappedToken = require('./scripts/deploy-wrapped-token');
        await deployWrappedToken(taskArgs.name, taskArgs.symbol, taskArgs.decimals);
    });

task('update-native-token', 'Updates native token to router')
    .addParam('router', 'The address of the router contract')
    .addParam('nativeToken', 'The address of the native token')
    .addParam('feePercentage', 'The fee percentage for the token')
    .addParam('status', 'The to-be-updated status of the token', true, types.boolean)
    .setAction(async (taskArgs) => {
        const updateNativeToken = require('./scripts/update-native-token');
        await updateNativeToken(taskArgs.router, taskArgs.nativeToken, taskArgs.feePercentage, taskArgs.status);
    });

task('deploy-router-wrapped-token', 'Deploy wrapped token from router contract')
    .addParam('router', 'The address of the router contract')
    .addParam('source', 'The chain id of the soure chain, where the native token is deployed')
    .addParam('native', 'The native token')
    .addParam('name', 'The token name')
    .addParam('symbol', 'The token symbol')
    .addParam('decimals', 'The token decimals', 18, types.int)
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const deployRouterWrappedToken = require('./scripts/deploy-router-wrapped-token');
        await deployRouterWrappedToken(
            taskArgs.router,
            taskArgs.source,
            taskArgs.native,
            taskArgs.name,
            taskArgs.symbol,
            taskArgs.decimals);
    });

task('update-member', 'Update member in router contract')
    .addParam('router', 'The address of the router contract')
    .addParam('member', 'The address of the member')
    .addParam('status', 'The to-be-updated status of the member', true, types.boolean)
    .setAction(async (taskArgs) => {
        const updateMember = require('./scripts/update-member');
        await updateMember(taskArgs.router, taskArgs.member, taskArgs.status);
    });

task('set-payment-token', 'Sets the router diamond with Payment token')
    .addParam('router', 'The address of the router contract')
    .addParam('paymentToken', 'The address of the payment token')
    .addParam('status', 'The to-be-updated status of the token', true, types.boolean)
    .setAction(async (taskArgs) => {
        const setPaymentToken = require('./scripts/set-payment-token');
        await setPaymentToken(taskArgs.router, taskArgs.paymentToken, taskArgs.status);
    });

task('mint-erc20', 'Mints wrapped ERC-20 to the corresponding network')
    .addParam('router', 'The address of the router contract')
    .addParam('sourceChainId', 'The chain id of the source chain')
    .addParam('targetChainId', 'The chain id of the target chain')
    .addParam('transactionId', 'The target transaction id')
    .addParam('wrappedAsset', 'The address of the wrapped asset')
    .addParam('receiver', 'The address of the receiver')
    .addParam('amount', 'The amount to be minted')
    .addParam('signatures', 'An array of signatures, split by ","')
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const signaturesArray = taskArgs.signatures.split(',');
        const mintERC20 = require('./scripts/erc-20-mint');
        await mintERC20(
            taskArgs.router,
            taskArgs.sourceChainId,
            taskArgs.targetChainId,
            taskArgs.transactionId,
            taskArgs.wrappedAsset,
            taskArgs.receiver,
            taskArgs.amount,
            signaturesArray);
    });
task('burn-erc20', 'Approves & Burns wrapped ERC-20 amount to the corresponding network')
    .addParam('router', 'The address of the router contract')
    .addParam('targetChainId', 'The chain id of the target chain')
    .addParam('wrappedAsset', 'The address of the wrapped asset')
    .addParam('amount', 'The target amount')
    .addParam('receiver', 'The address of the receiver on the target network')
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const burnERC20 = require('./scripts/burn-erc-20');
        await burnERC20(
            taskArgs.router,
            taskArgs.targetChainId,
            taskArgs.wrappedAsset,
            taskArgs.amount,
            taskArgs.receiver);
    });

task('lock-erc20', 'Locks native ERC-20 token amount to the corresponding network')
    .addParam('router', 'The address of the router contract')
    .addParam('targetChainId', 'The chain id of the target chain')
    .addParam('nativeAsset', 'The address of the native asset')
    .addParam('amount', 'The amount to be locked')
    .addParam('receiver', 'The address of the receiver')
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const lockERC20 = require('./scripts/lock-erc-20');
        await lockERC20(
            taskArgs.router,
            taskArgs.targetChainId,
            taskArgs.nativeAsset,
            taskArgs.amount,
            taskArgs.receiver);
    });

task('unlock-erc20', 'Unlocks native ERC-20 token amount to the corresponding network')
    .addParam('router', 'The address of the router contract')
    .addParam('sourceChainId', 'The chain id of the source chain')
    .addParam('targetChainId', 'The chain id of the target chain')
    .addParam('transactionId', 'The target transaction id')
    .addParam('nativeAsset', 'The address of the native asset')
    .addParam('receiver', 'The address of the receiver')
    .addParam('amount', 'The amount to be minted')
    .addParam('signatures', 'An array of signatures, split by ","')
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const unlockERC20 = require('./scripts/erc-20-unlock');
        const signaturesArray = taskArgs.signatures.split(',');
        await unlockERC20(
            taskArgs.router,
            taskArgs.sourceChainId,
            taskArgs.targetChainId,
            taskArgs.transactionId,
            taskArgs.nativeAsset,
            taskArgs.receiver,
            taskArgs.amount,
            signaturesArray);
    });

task('transfer-ownership', 'Transfers ownership of the given contract')
    .addParam('contract', 'The address of the contract')
    .addParam('newOwner', 'The address of the new owner')
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const transferOwnership = require('./scripts/transfer-ownership');
        await transferOwnership(taskArgs.contract, taskArgs.newOwner);
    });


task('updateFacet', 'Updates a facet in the router diamond')
    .addParam("facetName", "The addres of the router")
    .addParam("facetAddress", "The addres of the router")
    .addParam("routerAddress", "The addres of the router")
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const updateFacet = require('./scripts/update-facet');
        await updateFacet(taskArgs.facetName,taskArgs.facetAddress,taskArgs.routerAddress);
    });

task('removeFacet', 'Removes a facet from the router diamond')
    .addParam("facetAddress", "The address of the facet to remove")
    .addParam("routerAddress", "The address of the router")
    .setAction(async (taskArgs) => {
        const removeFacet = require('./scripts/remove-facet');
        await removeFacet(taskArgs.facetAddress, taskArgs.routerAddress);
    });

task('upgrade-fee-calculator', 'Deploys new FeeCalculatorFacet and upgrades router with gas cost functions')
    .addParam("routerAddress", "The address of the router diamond")
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const { upgradeFeeCalculatorFacet } = require('./scripts/upgrade-fee-calculator-facet');
        await upgradeFeeCalculatorFacet(taskArgs.routerAddress);
    });

module.exports = {
    solidity: {
        version: '0.8.3',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
                details: {
                    yul: false
                }
            },
        },
    },
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            hardfork: 'berlin'
        },
        local: {
            url: 'http://127.0.0.1:8545',
        },
        ropsten: {
            url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_PROJECT_ID}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
        },
        mumbai: {
            url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_PROJECT_ID}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
        },
    },
    etherscan: {
        apiKey: ''
    },
    mocha: {
        timeout: 20000,
    }
};
