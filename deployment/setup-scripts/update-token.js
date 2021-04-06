const etherlime = require("etherlime-lib");
const WrappedToken = require("../../build/WrappedToken.json");
const Router = require("../../build/Router.json");
const ethers = require("ethers");
const yargs = require("yargs");
const { boolean } = require("yargs");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";

const argv = yargs.option("routerAddress", {
    alias: "r",
    description: "Deployed router token",
    type: "string",
}).option("tokenAddress", {
    alias: "t",
    description: "Token address",
    type: "string",
}).option("wrappedToken", {
    alias: "w",
    description: "Wrapped token id",
    type: "string",
}).option("tokenStatus", {
    alias: "s",
    description: "The status of the token",
    type: "boolean",
}).argv;

const deploy = async (network, secret) => {
    const provider = new ethers.providers.InfuraProvider(network, INFURA_PROVIDER);
    const adminWallet = new ethers.Wallet(secret, provider);
    const routerInstance = new ethers.Contract(argv.routerAddress, Router.abi, adminWallet);

    let transaction = await routerInstance.updateWrappedToken(argv.tokenAddress, argv.tokenAddress, argv.tokenStatus);
    console.log("Transaction hash:", transaction.hash);
};

module.exports = {
    deploy
};