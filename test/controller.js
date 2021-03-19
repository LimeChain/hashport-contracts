const etherlime = require("etherlime-lib");
const Controller = require("../build/Controller");
const WHBAR = require("../build/WHBAR");
const Router = require("../build/Router");

const ethers = require("ethers");

describe("Controller", function () {
    this.timeout(10000);

    let owner = accounts[9];
    let aliceMember = accounts[1].signer;
    let nonMember = accounts[4].signer;
    let notAdmin = accounts[5].signer;
    let mockRouter = accounts[6].signer;

    let routerInstance;
    let controllerInstance;
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

        controllerInstance = await deployer.deploy(
            Controller,
            {},
            whbarInstance.contractAddress,
            serviceFee,
            wrappedId
        );

        routerInstance = await deployer.deploy(Router);

        await whbarInstance.setControllerAddress(controllerInstance.contractAddress);
    });

    describe("Contract Setup", function () {

        it("Should deploy Controller contract", async () => {
            assert.isAddress(
                controllerInstance.contractAddress,
                "The contract was not deployed"
            );
            const tokenAddress = await controllerInstance.wrappedToken();
            assert.equal(tokenAddress, whbarInstance.contractAddress);
            const _serviceFee = await controllerInstance.serviceFee();
            assert(_serviceFee.eq(serviceFee));
        });

        it("Should set router contract", async () => {
            await controllerInstance.setRouterContract(routerInstance.contractAddress);
            const router = await controllerInstance.routerContract();
            assert.equal(router, routerInstance.contractAddress);
        });

        it("Should revert if not owner tries to set router contract", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(controllerInstance.from(notAdmin).setRouterContract(routerInstance.contractAddress), expectedRevertMessage);

        });

        it("Should emit RouterContractSet event", async () => {
            const expectedEvent = "RouterContractSet";

            await assert.emit(
                controllerInstance.setRouterContract(routerInstance.contractAddress),
                expectedEvent
            );
        });

        it("Should emit RouterContractSet event arguments", async () => {
            const expectedEvent = "RouterContractSet";
            await assert.emitWithArgs(
                controllerInstance.setRouterContract(routerInstance.contractAddress),
                expectedEvent,
                [
                    routerInstance.contractAddress,
                    owner.signer.address
                ]
            );
        });

        it("Should set a service fee", async () => {
            const newFee = 7000;
            await controllerInstance.setServiceFee(newFee);
            const newServiceFee = await controllerInstance.serviceFee();
            assert.equal(newServiceFee, newFee);
        });

        it("Should emit ServiceFeeSet event", async () => {
            const newFee = 7000;

            const expectedEvent = "ServiceFeeSet";
            await assert.emit(
                controllerInstance.setServiceFee(newFee),
                expectedEvent
            );
        });

        it("Should emit ServiceFeeSet event arguments", async () => {
            const newFee = 7000;

            const expectedEvent = "ServiceFeeSet";
            await assert.emitWithArgs(
                controllerInstance.setServiceFee(newFee),
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
            await assert.revertWith(controllerInstance.from(aliceMember).setServiceFee(newFee), expectedRevertMessage);
        });

        it("Should revertWith if service fee is equal or above 100%", async () => {
            const newFee = precision;
            const expectedRevertMessage = "Controller: Service fee cannot exceed 100%";
            await assert.revertWith(controllerInstance.setServiceFee(newFee), expectedRevertMessage);
        });

        
    });


    describe("Mint", function () {

        beforeEach(async () => {

            await controllerInstance.setRouterContract(mockRouter.address);
        });

        it("Should execute mint transaction", async () => {

            const expectedCheckpoints = await controllerInstance.totalCheckpoints();

            const feesAccruedForCheckpointBeforeMint = await controllerInstance.checkpointServiceFeesAccrued(expectedCheckpoints);

            await controllerInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            assert(balanceOFReciever.eq(amount.sub(txCost).sub(expectedMintServiceFee)));

            const totalClaimableFees = await controllerInstance.totalClaimableFees();

            assert(totalClaimableFees.eq(expectedMintServiceFee.add(txCost)));

            const totalCheckpoints = await controllerInstance.totalCheckpoints();
            assert(expectedCheckpoints.eq(totalCheckpoints));

            const expectedFeesAccruedForCheckpoint = feesAccruedForCheckpointBeforeMint.add(expectedMintServiceFee);
            const feesAccruedForCheckpointAfterMint = await controllerInstance.checkpointServiceFeesAccrued(totalCheckpoints);
            assert(expectedFeesAccruedForCheckpoint.eq(feesAccruedForCheckpointAfterMint));
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";
            await assert.emit(controllerInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address), expectedEvent);
        });


        it("Should not execute mint transaction from other than router contract", async () => {
            const expectedRevertMessage = "Controller: Only executable from the router contract";
            await assert.revertWith(controllerInstance.mint(receiver, amount, txCost, transactionId, aliceMember.address), expectedRevertMessage);
        });

    });

    describe("Burn", function () {

        beforeEach(async () => {
            await controllerInstance.setRouterContract(mockRouter.address);
            await mint();
        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(controllerInstance.contractAddress, amountToBurn);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            const totalClaimableFees = await controllerInstance.totalClaimableFees();

            const expectedTotalCheckpoints = await controllerInstance.totalCheckpoints();
            const feesAccruedForCheckpointBeforeMint = await controllerInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);

            await controllerInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress);

            const balanceOFRecieverAfter = await whbarInstance.balanceOf(receiver);
            const totalClaimableFeesAfter = await controllerInstance.totalClaimableFees();

            const feeAmount = amountToBurn.mul(serviceFee).div(precision);
            const feesAccruedForCheckpointAfterMint = await controllerInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);

            assert(balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn)));

            assert(totalClaimableFeesAfter.eq(totalClaimableFees.add(feeAmount)));
            assert(feesAccruedForCheckpointAfterMint.eq(feesAccruedForCheckpointBeforeMint.add(feeAmount)));
        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(controllerInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emit(controllerInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress), expectedEvent);
        });

        it("Should emit burn event arguments", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const expectedServiceFee = amountToBurn.mul(serviceFee).div(precision);
            const expectedAmount = amountToBurn.sub(expectedServiceFee);
            await whbarInstance.from(nonMember).approve(controllerInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emitWithArgs(
                controllerInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress),
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
            await assert.revertWith(controllerInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(aliceMember).approve(controllerInstance.contractAddress, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await assert.revertWith(controllerInstance.from(mockRouter).burn(aliceMember.address, amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if deprecated", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(controllerInstance.contractAddress, amountToBurn);

            await controllerInstance.from(mockRouter).deprecate();

            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(controllerInstance.from(mockRouter).burn(receiver, amountToBurn, hederaAddress), expectedRevertMessage);
        });
    });

    describe("Deprecate", function () {

        beforeEach(async () => {
            await controllerInstance.setRouterContract(mockRouter.address);
            await mint();
        });

        it("Should deprecate Controller", async () => {
            let isPaused = await controllerInstance.paused();
            assert.ok(!isPaused);
            await controllerInstance.from(mockRouter).deprecate();
            const balanceOfcontroller = await whbarInstance.balanceOf(controllerInstance.contractAddress);
            const expectedBalance = amount.sub(txCost).mul(serviceFee).div(precision).add(txCost);
            assert(balanceOfcontroller.eq(expectedBalance));

            isPaused = await controllerInstance.paused();
            assert.ok(isPaused);
        });

        it("Should emit Deprecate event", async () => {
            const expectedEvent = "Deprecate";
            await assert.emit(controllerInstance.from(mockRouter).deprecate(), expectedEvent);
        });

        it("Should emit Deprecate event arguments", async () => {
            const expectedAmount = await controllerInstance.totalClaimableFees();
            const expectedEvent = "Deprecate";
            await assert.emitWithArgs(
                controllerInstance.from(mockRouter).deprecate(),
                expectedEvent,
                [
                    mockRouter.address,
                    expectedAmount
                ]);
        });

        it("Should not deprecate Controller if already deprecated", async () => {
            await controllerInstance.from(mockRouter).deprecate();
            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(controllerInstance.from(mockRouter).deprecate(), expectedRevertMessage);
        });

        it("Should not deprecate Controller if not called from owner", async () => {
            const expectedRevertMessage = "Controller: Only executable from the router contract";
            await assert.revertWith(controllerInstance.from(aliceMember).deprecate(), expectedRevertMessage);
        });

        it("Should not allow mint transaction if deprecated", async () => {
            await controllerInstance.from(mockRouter).deprecate();

            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(controllerInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address), expectedRevertMessage);
        });
    });
    async function mint() {
        await controllerInstance.from(mockRouter).mint(receiver, amount, txCost, transactionId, aliceMember.address);
    }
});

