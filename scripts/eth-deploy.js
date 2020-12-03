const etherlime = require('etherlime-lib');
const Bridge = require("../build/Bridge.json");

async function deploy(network, privateKey, apiKey) {
  let deployer;
  if (!network) {
    deployer = new etherlime.EtherlimeGanacheDeployer();
  } else {
    deployer = new etherlime.InfuraPrivateKeyDeployer(privateKey, network, apiKey);
  }

  const contractInstance = await deployer.deploy(Bridge, {});
  console.log(`contract address = ${contractInstance.contract.address}`);
}

async function main() {
  const network = process.env.NETWORK;
  const privateKey = process.env.PRIVATE_KEY;
  const apiKey = process.env.API_KEY;

  if (privateKey == null) {
    console.log('missing private key');
    return
  }

  await deploy(network, privateKey, apiKey);
}

void main();
