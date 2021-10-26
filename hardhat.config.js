const { task } = require('hardhat/config');

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID || '';
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
    .addVariadicPositionalParam('members', 'The addresses of the members')
    .setAction(async (taskArgs) => {
        const deployRouter = require('./scripts/deploy-router');
        await deployRouter(
            taskArgs.owner,
            taskArgs.governancePercentage,
            taskArgs.governancePrecision,
            taskArgs.feeCalculatorPrecision,
            taskArgs.members);
    });

task('deploy-token', 'Deploys token to the provided network')
    .addParam('name', 'The token name')
    .addParam('symbol', 'The token symbol')
    .addParam('decimals', 'The token decimals', 18, types.int)
    .setAction(async (taskArgs) => {
        const deployToken = require('./scripts/deploy-token');
        await deployToken(taskArgs.name, taskArgs.symbol, taskArgs.decimals);
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

task('deploy-wrapped-token', 'Deploy wrapped token from router contract')
    .addParam('router', 'The address of the router contract')
    .addParam('source', 'The chain id of the soure chain, where the native token is deployed')
    .addParam('native', 'The native token')
    .addParam('name', 'The token name')
    .addParam('symbol', 'The token symbol')
    .addParam('decimals', 'The token decimals', 18, types.int)
    .setAction(async (taskArgs) => {
        console.log(taskArgs);
        const deployWrappedToken = require('./scripts/deploy-wrapped-token');
        await deployWrappedToken(
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
            url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
        },
        mumbai: {
            url: `https://rpc-mumbai.maticvigil.com`,
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
