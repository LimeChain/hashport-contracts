const addPair = async (router, tokenId, wrappedToken) => {
    const routerInstance = await ethers.getContractAt("Router", router);

    const nativeIdInBytes = ethers.utils.formatBytes32String(tokenId);

    const transaction = await routerInstance.addPair(
        nativeIdInBytes,
        wrappedToken
    );
    console.log("Transaction hash:", transaction.hash);
};

module.exports = addPair;
