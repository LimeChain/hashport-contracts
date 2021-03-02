const etherlime = require("etherlime-lib");
const WHBAR = require("../build/WHBAR.json");
const Bridge = require("../build/Bridge.json");

const INFURA_PROVIDER = "14ac2dd6bdcb485bb22ed4aa76d681ae";
// NOTE: Set the correct multisig owner of the contracts
const multisigWallet = "0x39F00e926DeE09De7f44646a640e83fd912Bec17";

// 5% multiplied by 1000
const serviceFee = "5000";

const deploy = async (network, secret) => {
    let deployer;

    if (!network) {
        deployer = new etherlime.EtherlimeGanacheDeployer();
    } else {
        deployer = new etherlime.InfuraPrivateKeyDeployer(secret, network, INFURA_PROVIDER);
    }

    whbarInstance = await deployer.deploy(WHBAR, {}, "Wrapper HBAR", "WHBAR", 8);
    bridgeInstance = await deployer.deploy(Bridge, {}, whbarInstance.contractAddress, serviceFee);

    await whbarInstance.setControllerAddress(bridgeInstance.contractAddress);


    await bridgeInstance.updateMember("0x7BB03D96f9D0e233bfF99eC6aa1c5d035Cd3d1c1", true);
    await bridgeInstance.updateMember("0x4fA67c4ebC625B496eFC85c3ebf757551Da88dED", true);
    await bridgeInstance.updateMember("0x8f35870Df31C5C3b9f7772f3dA20EB580e865AB3", true);

    // await whbarInstance.transferOwnership(multisigWallet);
    // await bridgeInstance.transferOwnership(multisigWallet);
};

module.exports = {
    deploy
};