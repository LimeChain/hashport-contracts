const etherlime = require("etherlime-lib");
const Bridge = require("../build/Bridge");
const WHBAR = require("../build/WHBAR");
const Router = require("../build/BridgeRouter");

const ethers = require("ethers");

describe("Bridge", function () {
    this.timeout(10000);

    let owner = accounts[9];
    let aliceMember = accounts[1].signer;
    let bobMember = accounts[2].signer;
    let carlMember = accounts[3].signer;
    let nonMember = accounts[4].signer;
    let notAdmin = accounts[5].signer;
    let mockRouter = accounts[6].signer;

    let routerInstance;
    let bridgeInstance;
    let whbarInstance;

    const name = "WrapedHBAR";
    const symbol = "WHBAR";
    const decimals = 8;

    // 5% multiplied by 1000
    const serviceFee = "5000";

    const transactionId = ethers.utils.formatBytes32String("0.0.0000-0000000000-000000000");
    const hederaAddress = ethers.utils.formatBytes32String("0.0.0000");
    const wrappedId = ethers.utils.formatBytes32String("0.0.0001");
    const receiver = nonMember.address;
    const amount = ethers.utils.parseEther("100");
    const txCost = ethers.utils.parseEther("1");
    const precision = 100000;
    const expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);

    beforeEach(async () => {
        deployer = new etherlime.EtherlimeGanacheDeployer(owner.secretKey);
        whbarInstance = await deployer.deploy(
            WHBAR,
            {},
            name,
            symbol,
            decimals
        );

        bridgeInstance = await deployer.deploy(
            Bridge,
            {},
            whbarInstance.contractAddress,
            serviceFee,
            wrappedId
        );

        routerInstance = await deployer.deploy(Router);

        await whbarInstance.setControllerAddress(bridgeInstance.contractAddress);
    });

    describe("Contract Setup", function () {

        it("Should deploy Bridge contract", async () => {
            assert.isAddress(
                bridgeInstance.contractAddress,
                "The contract was not deployed"
            );
            const tokenAddress = await bridgeInstance.wrappedToken();
            assert.equal(tokenAddress, whbarInstance.contractAddress);
            const _serviceFee = await bridgeInstance.serviceFee();
            assert(_serviceFee.eq(serviceFee));
        });

        it("Should set router contract", async () => {
            await bridgeInstance.setRouterContract(routerInstance.contractAddress);
            const router = await bridgeInstance.routerContract();
            assert.equal(router, routerInstance.contractAddress);
        });

        it("Should revert if not owner tries to set router contract", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(bridgeInstance.from(notAdmin).setRouterContract(routerInstance.contractAddress), expectedRevertMessage);

        });

        it("Should emit RouterContractSet event", async () => {
            const expectedEvent = "RouterContractSet";

            await assert.emit(
                bridgeInstance.setRouterContract(routerInstance.contractAddress),
                expectedEvent
            );
        });

        it("Should emit RouterContractSet event arguments", async () => {
            const expectedEvent = "RouterContractSet";
            await assert.emitWithArgs(
                bridgeInstance.setRouterContract(routerInstance.contractAddress),
                expectedEvent,
                [
                    routerInstance.contractAddress,
                    owner.signer.address
                ]
            );
        });

        it("Should set a service fee", async () => {
            const newFee = 7000;
            await bridgeInstance.setServiceFee(newFee);
            const newServiceFee = await bridgeInstance.serviceFee();
            assert.equal(newServiceFee, newFee);
        });

        it("Should emit ServiceFeeSet event", async () => {
            const newFee = 7000;

            const expectedEvent = "ServiceFeeSet";
            await assert.emit(
                bridgeInstance.setServiceFee(newFee),
                expectedEvent
            );
        });

        it("Should emit ServiceFeeSet event arguments", async () => {
            const newFee = 7000;

            const expectedEvent = "ServiceFeeSet";
            await assert.emitWithArgs(
                bridgeInstance.setServiceFee(newFee),
                expectedEvent,
                [
                    owner.signer.address,
                    newFee
                ]
            );
        });

        it("Should not set a service fee if not from owner", async () => {
            const newFee = 7000;

            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(bridgeInstance.from(aliceMember).setServiceFee(newFee), expectedRevertMessage);
        });

        it("Should revertWith if service fee is equal or above 100%", async () => {
            const newFee = precision;
            const expectedRevertMessage = "Bridge: Service fee cannot exceed 100%";
            await assert.revertWith(bridgeInstance.setServiceFee(newFee), expectedRevertMessage);
        });
    });


    describe("Mint", function () {

        beforeEach(async () => {

            await bridgeInstance.setRouterContract(mockRouter.address);
        });

        it("Should execute mint transaction", async () => {

            const expectedCheckpoints = await bridgeInstance.totalCheckpoints();

            const feesAccruedForCheckpointBeforeMint = await bridgeInstance.checkpointServiceFeesAccrued(expectedCheckpoints);

            await bridgeInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            assert(balanceOFReciever.eq(amount.sub(txCost).sub(expectedMintServiceFee)));

            const totalClaimableFees = await bridgeInstance.totalClaimableFees();

            assert(totalClaimableFees.eq(expectedMintServiceFee.add(txCost)));

            const totalCheckpoints = await bridgeInstance.totalCheckpoints();
            assert(expectedCheckpoints.eq(totalCheckpoints));

            const expectedFeesAccruedForCheckpoint = feesAccruedForCheckpointBeforeMint.add(expectedMintServiceFee);
            const feesAccruedForCheckpointAfterMint = await bridgeInstance.checkpointServiceFeesAccrued(totalCheckpoints);
            assert(expectedFeesAccruedForCheckpoint.eq(feesAccruedForCheckpointAfterMint));
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";
            await assert.emit(bridgeInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address), expectedEvent);
        });


        it("Should not execute mint transaction from other than router contract", async () => {
            const expectedRevertMessage = "Bridge: Only executable from the router contract";
            await assert.revertWith(bridgeInstance.mint(receiver, amount, txCost, transactionId, aliceMember.address), expectedRevertMessage);
        });

    });

    describe("Burn", function () {

        beforeEach(async () => {
            await bridgeInstance.setRouterContract(mockRouter.address);
            await mint();
        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            const totalClaimableFees = await bridgeInstance.totalClaimableFees();

            const expectedTotalCheckpoints = await bridgeInstance.totalCheckpoints();
            const feesAccruedForCheckpointBeforeMint = await bridgeInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);

            await bridgeInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress);

            const balanceOFRecieverAfter = await whbarInstance.balanceOf(receiver);
            const totalClaimableFeesAfter = await bridgeInstance.totalClaimableFees();

            const feeAmount = amountToBurn.mul(serviceFee).div(precision);
            const feesAccruedForCheckpointAfterMint = await bridgeInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);

            assert(balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn)));

            assert(totalClaimableFeesAfter.eq(totalClaimableFees.add(feeAmount)));
            assert(feesAccruedForCheckpointAfterMint.eq(feesAccruedForCheckpointBeforeMint.add(feeAmount)));
        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emit(bridgeInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress), expectedEvent);
        });

        it("Should emit burn event arguments", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const expectedServiceFee = amountToBurn.mul(serviceFee).div(precision);
            const expectedAmount = amountToBurn.sub(expectedServiceFee);
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emitWithArgs(
                bridgeInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress),
                expectedEvent,
                [
                    nonMember.address,
                    expectedAmount,
                    expectedServiceFee,
                    hederaAddress
                ]);
        });

        it("Should revert if there are no approved tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");

            const expectedRevertMessage = "ERC20: burn amount exceeds allowance";
            await assert.revertWith(bridgeInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(aliceMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await assert.revertWith(bridgeInstance.from(mockRouter).burn(aliceMember.address, amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if deprecated", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            await bridgeInstance.from(mockRouter).deprecate();

            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(bridgeInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress), expectedRevertMessage);
        });
    });

    describe("Deprecate", function () {

        beforeEach(async () => {
            await bridgeInstance.setRouterContract(mockRouter.address);
            await mint();
        });

        it("Should deprecate Bridge", async () => {
            let isPaused = await bridgeInstance.paused();
            assert.ok(!isPaused);
            await bridgeInstance.from(mockRouter).deprecate();
            const balanceOfBridge = await whbarInstance.balanceOf(bridgeInstance.contractAddress);
            const expectedBalance = amount.sub(txCost).mul(serviceFee).div(precision).add(txCost);
            assert(balanceOfBridge.eq(expectedBalance));

            isPaused = await bridgeInstance.paused();
            assert.ok(isPaused);
        });

        it("Should emit Deprecate event", async () => {
            const expectedEvent = "Deprecate";
            await assert.emit(bridgeInstance.from(mockRouter).deprecate(), expectedEvent);
        });

        it("Should emit Deprecate event arguments", async () => {
            const expectedAmount = await bridgeInstance.totalClaimableFees();
            const expectedEvent = "Deprecate";
            await assert.emitWithArgs(
                bridgeInstance.from(mockRouter).deprecate(),
                expectedEvent,
                [
                    mockRouter.address,
                    expectedAmount
                ]);
        });

        it("Should not deprecate Bridge if already deprecated", async () => {
            await bridgeInstance.from(mockRouter).deprecate();
            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(bridgeInstance.from(mockRouter).deprecate(), expectedRevertMessage);
        });

        it("Should not deprecate Bridge if not called from owner", async () => {
            const expectedRevertMessage = "Bridge: Only executable from the router contract";
            await assert.revertWith(bridgeInstance.from(aliceMember).deprecate(), expectedRevertMessage);
        });

        it("Should not allow mint transaction if deprecated", async () => {
            await bridgeInstance.from(mockRouter).deprecate();

            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(bridgeInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address), expectedRevertMessage);
        });
    });
    async function mint() {
        await bridgeInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address);
    }
});

