const Router = require("../../build/Router.json");
const ethers = require("ethers");
const yargs = require("yargs");
const { boolean } = require("yargs");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";

const argv = yargs.option("secret", {
    alias: "prk",
    description: "Wallet private key",
    type: "string",
}).option("network", {
    alias: "n",
    description: "Ethereum network",
    type: "string",
}).option("routerAddress", {
    alias: "r",
    description: "Deployed router token",
    type: "string",
}).option("wrappedToken", {
    alias: "w",
    description: "Wrapped token address",
    type: "string",
}).option("tokenId", {
    alias: "t",
    description: "Hedera token id",
    type: "string",
}).option("tokenStatus", {
    alias: "s",
    description: "The status of the token",
    type: "boolean",
}).argv;

async function updateToken() {
    const provider = new ethers.providers.InfuraProvider(argv.network, INFURA_PROVIDER);
    const adminWallet = new ethers.Wallet(argv.secret, provider);
    const routerInstance = new ethers.Contract(argv.routerAddress, Router.abi, adminWallet);

    const tokenId = ethers.utils.formatBytes32String(argv.tokenId);

    const transaction = await routerInstance.updateWrappedToken(argv.wrappedToken, tokenId, argv.tokenStatus);
    console.log("Transaction hash:", transaction.hash);
};

updateToken();