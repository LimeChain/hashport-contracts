const updateMember = async (router, member, status) => {
    const routerInstance = await ethers.getContractAt("Router", router);

    let transaction = await routerInstance.updateMember(member, status, {
        gasLimit: 3000000,
    });
    console.log("Transaction hash:", transaction.hash);
};

module.exports = updateMember;