const { task } = require("hardhat/config");

/**
 * @type import("hardhat/config").HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require("hardhat-gas-reporter");

task("deploy-router", "Deploys Router contract will all the necessary facets")
    .addParam("owner", "The owner of the to-be deployed router")
    .addParam("governancePercentage", "The percentage of how many of the total members are required to sign given message", 50, types.int)
    .addParam("governancePrecision", "The precision of division of required members signatures", 100, types.int)
    .addParam("feeCalculatorPrecision", "The precision of fee calculations for native tokens", 100_000, types.int)
    .addVariadicPositionalParam("members", "The addresses of the members")
    .setAction(async (taskArgs) => {
        const deployRouter = require('./scripts/deploy-router');
        await deployRouter(
            taskArgs.owner,
            taskArgs.governancePercentage,
            taskArgs.governancePrecision,
            taskArgs.feeCalculatorPrecision,
            taskArgs.members);
    });

task("deploy-token", "Deploys token to the provided network")
    .addParam("name", "The token name")
    .addParam("symbol", "The token symbol")
    .addParam("decimals", "The token decimals", 18, types.int)
    .setAction(async (taskArgs) => {
        const deployToken = require('./scripts/deploy-token');
        await deployToken(taskArgs.name, taskArgs.symbol, taskArgs.decimals);
    });

task("deploy-wrapped-token", "Deploy wrapped token from router contract")
    .addParam("router", "The address of the router contract")
    .addParam("source", "The chain id of the soure chain, where the native token is deployed")
    .addParam("native", "The native token")
    .addParam("name", "The token name")
    .addParam("symbol", "The token symbol")
    .addParam("decimals", "The token decimals", 18, types.int)
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

module.exports = {
    solidity: {
        version: "0.8.0",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    defaultNetwork: "hardhat",
    networks: {
        local: {
            url: "http://127.0.0.1:8545",
        },
        ropsten: {
            url: `https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            accounts: [`0x${process.env.ROPSTEN_PRIVATE_KEY}`]
        },
        mumbai: {
            url: `https://rpc-mumbai.maticvigil.com`,
            accounts: [`0x${process.env.MUMBAI_PRIVATE_KEY}`]
        },
    },
    mocha: {
        timeout: 20000,
    }
};
