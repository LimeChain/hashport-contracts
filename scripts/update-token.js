const updateToken = async (router, tokenId, wrappedToken) => {
    const routerInstance = await ethers.getContractAt("Router", router);

    const tokenIdInBytes = ethers.utils.formatBytes32String(tokenId);

    const transaction = await routerInstance.addPair(
        tokenIdInBytes,
        wrappedToken
    );
    console.log("Transaction hash:", transaction.hash);
};

module.exports = updateToken;
