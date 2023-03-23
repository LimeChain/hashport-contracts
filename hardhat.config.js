const { task } = require('hardhat/config');

const ALCHEMY_PROJECT_ID = process.env.ALCHEMY_PROJECT_ID || '';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || 'f39fd6e51aad88f6f4ce6ab8827279cfffb92266';

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-etherscan");
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

task('deploy-wrapped-erc721-transfer-ownership', 'Deploys Wrapped ERC-721 and transfer ownership to Router')
    .addParam('router', 'The address of the router contract')
    .addParam('name', 'Name for ERC-721')
    .addParam('symbol', ' Symbol for ERC-721')
    .setAction(async (taskArgs) => {
        const deployWrappedERC721TransferOwnership = require('./scripts/deploy-wrapped-erc721-transfer-ownership');
        await deployWrappedERC721TransferOwnership(taskArgs.router, taskArgs.name, taskArgs.symbol);
    });

task('deploy-wrapped-erc721-pausable-transfer-ownership', 'Deploys Wrapped ERC-721Pausable and transfer ownership to Router')
    .addParam('router', 'The address of the router contract')
    .addParam('name', 'Name for ERC-721Pausable')
    .addParam('symbol', ' Symbol for ERC-721Pausable')
    .setAction(async (taskArgs) => {
        const deployWrappedERC721PausableTransferOwnership = require('./scripts/deploy-wrapped-erc721-pausable-transfer-ownership');
        await deployWrappedERC721PausableTransferOwnership(taskArgs.router, taskArgs.name, taskArgs.symbol);
    });

task('update-member', 'Update member in router contract')
    .addParam('router', 'The address of the router contract')
    .addParam('member', 'The address of the member')
    .addParam('status', 'The to-be-updated status of the member', true, types.boolean)
    .setAction(async (taskArgs) => {
        const updateMember = require('./scripts/update-member');
        await updateMember(taskArgs.router, taskArgs.member, taskArgs.status);
    });

task('upgrade-erc721-support', 'Upgrades the router diamond with Payment and ERC-721 facets')
    .addParam('router', 'The address of the router contract')
    .setAction(async (taskArgs) => {
        const { upgradeErc721Support } = require('./scripts/upgrade-erc721-support');
        await upgradeErc721Support(taskArgs.router);
    });

task('set-payment-token', 'Sets the router diamond with Payment token')
    .addParam('router', 'The address of the router contract')
    .addParam('paymentToken', 'The address of the payment token')
    .addParam('status', 'The to-be-updated status of the token', true, types.boolean)
    .setAction(async (taskArgs) => {
        const setPaymentToken = require('./scripts/set-payment-token');
        await setPaymentToken(taskArgs.router, taskArgs.paymentToken, taskArgs.status);
    });

task('set-erc721-payment', 'Sets the router diamond payment for a Wrapped ERC-721')
    .addParam('router', 'The address of the router contract')
    .addParam('erc721', 'The address of the ERC-721')
    .addParam('paymentToken', 'The address of the payment token')
    .addParam('fee', 'The amount to be charged upon Wrapped ERC-721 Burn')
    .setAction(async (taskArgs) => {
        const setERC721Payment = require('./scripts/set-erc721-payment');
        await setERC721Payment(taskArgs.router, taskArgs.erc721, taskArgs.paymentToken, taskArgs.fee);
    });

task('mint-erc721', 'Mints wrapped ERC-721 to the corresponding network')
    .addParam('router', 'The address of the router contract')
    .addParam('sourceChainId', 'The chain id of the source chain')
    .addParam('targetChainId', 'The chain id of the target chain')
    .addParam('transactionId', 'The target transaction id')
    .addParam('wrappedAsset', 'The address of the wrapped asset')
    .addParam('tokenId', 'The target token ID')
    .addParam('metadata', 'The token ID metadata')
    .addParam('receiver', 'The address of the receiver')
    .addParam('signatures', 'An array of signatures, split by ","')
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const signaturesArray = taskArgs.signatures.split(',');
        const mintERC721 = require('./scripts/erc-721-mint');
        await mintERC721(
            taskArgs.router,
            taskArgs.sourceChainId,
            taskArgs.targetChainId,
            taskArgs.transactionId,
            taskArgs.wrappedAsset,
            taskArgs.tokenId,
            taskArgs.metadata,
            taskArgs.receiver,
            signaturesArray);
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

task('burn-erc721', 'Burns wrapped ERC-721 tokenID to the corresponding network')
    .addParam('router', 'The address of the router contract')
    .addParam('targetChainId', 'The chain id of the target chain')
    .addParam('wrappedAsset', 'The address of the wrapped asset')
    .addParam('tokenId', 'The id of the token')
    .addParam('receiver', 'The address of the receiver')
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const burnERC721 = require('./scripts/burn-erc-721');
        await burnERC721(
            taskArgs.router,
            taskArgs.targetChainId,
            taskArgs.wrappedAsset,
            taskArgs.tokenId,
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

task('deployERC721PortalFacet', 'Deploys ERC721PortalFacet')
    .setAction(async () => {
        const deployERC721PortalFacet = require('./scripts/deploy-erc721-portal-facet');
        await deployERC721PortalFacet();
    });


task('updateFacet', 'Deploys ERC721PortalFacet')
    .addParam("facetName", "The addres of the router")
    .addParam("facetAddress", "The addres of the router")
    .addParam("routerAddress", "The addres of the router")
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const updateFacet = require('./scripts/update-Facet');
        await updateFacet(taskArgs.facetName,taskArgs.facetAddress,taskArgs.routerAddress);
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
