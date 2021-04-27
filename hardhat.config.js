/**
 * @type import("hardhat/config").HardhatUserConfig
 */
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require("hardhat-gas-reporter");

/**
 * @dev set your private key and infura api key
 */
const INFURA_KEY = "";
const DEPLOYER_PRIVATE_KEY = "";

const lazyImport = async (module) => {
    const importedDefault = await import(module);
    return importedDefault.default;
};

task("deploy", "Deploys the hedera eth bridge").setAction(async (taskArgs) => {
    const deploy = await lazyImport("./scripts/deploy.js");

    await deploy();
});

task("deploy-testnet", "Deploys the hedera eth bridge on testnet")
    .addParam("members", "The count of the validator members")
    .setAction(async (taskArgs) => {
        const deploy = await lazyImport("./scripts/deploy-testnet.js");
        await deploy(taskArgs.members);
    });

task("deploy-token", "Deploys wrapped token")
    .addParam("controller", "The address of the controller contract")
    .addParam("name", "The name of the token")
    .addParam("symbol", "The symbol of the token")
    .addParam("decimals", "Token decimals")
    .setAction(async (taskArgs) => {
        const deploy = await lazyImport("./scripts/deploy-token.js");
        await deploy(
            taskArgs.controller,
            taskArgs.name,
            taskArgs.symbol,
            taskArgs.decimals
        );
    });

task("update-member", "Updates member status")
    .addParam("router", "The address of the router contract")
    .addParam("member", "The address of the member")
    .addParam("status", "The status of the member")
    .setAction(async (taskArgs) => {
        const updateMember = await lazyImport("./scripts/update-member.js");
        await updateMember(taskArgs.router, taskArgs.member, taskArgs.status);
    });

task("add-pair", "Adds a new pair")
    .addParam("router", "The address of the router contract")
    .addParam("native", "The id of the hedera token")
    .addParam("wrapped", "The address of the wrapped token")
    .setAction(async (taskArgs) => {
        const addPair = await lazyImport("./scripts/add-pair.js");
        await addPair(taskArgs.router, taskArgs.native, taskArgs.wrapped);
    });

task("remove-pair", "Removes a pair")
    .addParam("router", "The address of the router contract")
    .addParam("native", "The id of the hedera token")
    .addParam("wrapped", "The address of the wrapped token")
    .setAction(async (taskArgs) => {
        const removePair = await lazyImport("./scripts/remove-pair.js");
        await removePair(taskArgs.router, taskArgs.native, taskArgs.wrapped);
    });

module.exports = {
    solidity: {
        version: "0.7.0",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        local: {
            url: "http://127.0.0.1:8545",
        },
    },
    mocha: {
        timeout: 20000,
    },
    gasReporter: {
        currency: "USD",
        gasPrice: 256,
        enabled: false,
    },
};
