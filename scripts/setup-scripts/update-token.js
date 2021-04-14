const updateToken = async (router, tokenId, wrappedToken, tokenStatus) => {
    const routerInstance = await ethers.getContractAt("Router", router);

    const tokenIdInBytes = ethers.utils.formatBytes32String(tokenId);

    const transaction = await routerInstance.updateWrappedToken(wrappedToken, tokenIdInBytes, tokenStatus);
    console.log("Transaction hash:", transaction.hash);
};

module.exports = updateToken;