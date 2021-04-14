/**
 * @type import("hardhat/config").HardhatUserConfig
 */
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");

/**
 * @dev set your private key and infura api key
 */
const INFURA_KEY = "";
const DEPLOYER_PRIVATE_KEY = "";

const lazyImport = async (module) => {
  const importedDefault = await import(module);
  return importedDefault.default;
};

task("deploy", "Deploys the hedera eth bridge")
  .setAction(async taskArgs => {
    const deploy = await lazyImport("./scripts/deploy.js");

    await deploy();
  });

task("deploy-testnet", "Deploys the hedera eth bridge on testnet")
  .addParam("members", "The count of the validator members")
  .setAction(async taskArgs => {

    const deploy = await lazyImport("./scripts/deploy-testnet.js");
    await deploy(taskArgs.members);
  });

task("deploy-token", "Deploys wrapped token")
  .addParam("controller", "The address of the controller contract")
  .addParam("name", "The name of the token")
  .addParam("symbol", "The symbol of the token")
  .addParam("decimals", "Token decimals")
  .setAction(async taskArgs => {

    const deploy = await lazyImport("./scripts/deploy-token.js");
    await deploy(taskArgs.controller, taskArgs.name, taskArgs.symbol, taskArgs.decimals);
  });

task("update-member", "Updates member status")
  .addParam("router", "The address of the router contract")
  .addParam("member", "The address of the member")
  .addParam("status", "The status of the member")
  .setAction(async taskArgs => {

    const updateMember = await lazyImport("./scripts/update-member.js");
    await updateMember(taskArgs.router, taskArgs.member, taskArgs.status);
  });

task("update-token", "Deploys wrapped token")
  .addParam("router", "The address of the router contract")
  .addParam("id", "The id of the hedera token")
  .addParam("token", "The address of the wrapped token")
  .addParam("status", "The status of the member")
  .setAction(async taskArgs => {

    const updateToken = await lazyImport("./scripts/update-token.js");
    await updateToken(taskArgs.router, taskArgs.id, taskArgs.token, taskArgs.status);
  });

module.exports = {
  solidity: {
    version: "0.6.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    local: {
      url: "http://127.0.0.1:8545",
      accounts: [
        "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
      ]
    },
    // ropsten: {
    //   url: `https://ropsten.infura.io/v3/${INFURA_KEY}`,
    //   accounts: [
    //     DEPLOYER_PRIVATE_KEY
    //   ]
    // },
    // rinkeby: {
    //   url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
    //   accounts: [
    //     DEPLOYER_PRIVATE_KEY
    //   ]
    // },
    // kovan: {
    //   url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
    //   accounts: [
    //     DEPLOYER_PRIVATE_KEY
    //   ]
    // },
    // mainnet: {
    //   url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    //   accounts: [
    //     DEPLOYER_PRIVATE_KEY
    //   ]
    // }
  },
  mocha: {
    timeout: 20000
  }
};