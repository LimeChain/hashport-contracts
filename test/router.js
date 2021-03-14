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
    const receiver = nonMember.address;
    const amount = ethers.utils.parseEther("100");
    const txCost = ethers.utils.parseEther("10");
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
            serviceFee
        );

        routerInstance = await deployer.deploy(Router);

        await whbarInstance.setControllerAddress(bridgeInstance.contractAddress);
    });

    describe("Contract Setup", function () {

        it("Should deploy Router contract", async () => {
            assert.isAddress(
                routerInstance.contractAddress,
                "The contract was not deployed"
            );
        });

        it("Should set a member", async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            const aliceStatus = await routerInstance.isMember(aliceMember.address);
            assert.ok(aliceStatus);
            const addressAtIndex = await routerInstance.memberAt(0);
            assert.equal(addressAtIndex, aliceMember.address);
            const membersCount = await routerInstance.membersCount();
            const expectedCount = 1;
            assert(membersCount.eq(expectedCount));
        });

        it("Should set multiple members", async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            await routerInstance.updateMember(carlMember.address, true);
            const aliceStatus = await routerInstance.isMember(aliceMember.address);
            const bobStatus = await routerInstance.isMember(bobMember.address);
            const carlStatus = await routerInstance.isMember(carlMember.address);
            assert.ok(aliceStatus);
            assert.ok(bobStatus);
            assert.ok(carlStatus);
            const membersCount = await routerInstance.membersCount();
            const expectedCount = 3;
            assert.equal(membersCount.toString(), expectedCount);

            const aliceAtIndex = await routerInstance.memberAt(0);
            assert.equal(aliceAtIndex, aliceMember.address);

            const bobAtIndex = await routerInstance.memberAt(1);
            assert.equal(bobAtIndex, bobMember.address);

            const carlAtIndex = await routerInstance.memberAt(2);
            assert.equal(carlAtIndex, carlMember.address);
        });

        it("Should not set a member if not from owner", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(routerInstance.from(notAdmin.address).updateMember(aliceMember.address, true), expectedRevertMessage);
        });

        it("Should not set same member twice", async () => {
            const expectedRevertMessage = "Governance: Account already added";

            await routerInstance.updateMember(aliceMember.address, true);
            await assert.revertWith(routerInstance.updateMember(aliceMember.address, true), expectedRevertMessage);
        });

        it("Should emit MemberUpdated event", async () => {
            const expectedEvent = "MemberUpdated";
            await assert.emit(
                routerInstance.updateMember(
                    aliceMember.address,
                    true
                ),
                expectedEvent
            );
        });

        it("Should emit MemberUpdated event arguments", async () => {
            const expectedEvent = "MemberUpdated";
            await assert.emitWithArgs(
                routerInstance.updateMember(
                    aliceMember.address,
                    true
                ),
                expectedEvent,
                [
                    aliceMember.address,
                    true
                ]
            );
        });

        it("Should remove a member", async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            let aliceStatus = await routerInstance.isMember(aliceMember.address);
            assert.ok(aliceStatus);
            let membersCount = await routerInstance.membersCount();
            let expectedCount = 2;
            assert(membersCount.eq(expectedCount));

            await routerInstance.updateMember(aliceMember.address, false);
            aliceStatus = await routerInstance.isMember(aliceMember.address);
            assert.ok(!aliceStatus);

            membersCount = await routerInstance.membersCount();
            expectedCount = 1;
            assert(membersCount.eq(expectedCount));
        });

        it("Should not remove same member twice", async () => {
            await routerInstance.updateMember(aliceMember.address, true);

            await routerInstance.updateMember(aliceMember.address, false);

            const expectedRevertMessage = "Governance: Account is not a member";
            await assert.revertWith(routerInstance.updateMember(aliceMember.address, false), expectedRevertMessage);
        });

        it("Should set bridge contract", async () => {
            await routerInstance.setBridgeContract(bridgeInstance.contractAddress, true);
            const bridgesCount = await routerInstance.bridgesCount();
            assert(bridgesCount.eq(1));
            const isBridge = await routerInstance.isBridge(bridgeInstance.contractAddress);
            assert.ok(isBridge);

            const bridgeAddress = await routerInstance.bridgeAt(0);
            assert.equal(bridgeAddress, bridgeInstance.contractAddress);
        });

        it("Should revert if not owner tries to set bridge contract", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(routerInstance.from(notAdmin).setBridgeContract(bridgeInstance.contractAddress, true), expectedRevertMessage);

        });

        it("Should emit BridgeContractSet event", async () => {
            const expectedEvent = "BridgeContractSet";

            await assert.emit(
                routerInstance.setBridgeContract(bridgeInstance.contractAddress, true),
                expectedEvent
            );
        });

        it("Should emit BridgeContractSet event arguments", async () => {
            const expectedEvent = "BridgeContractSet";
            await assert.emitWithArgs(
                routerInstance.setBridgeContract(bridgeInstance.contractAddress, true),
                expectedEvent,
                [
                    bridgeInstance.contractAddress,
                    true
                ]
            );
        });

    });


    describe("Mint", function () {

        beforeEach(async () => {

            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            await routerInstance.updateMember(carlMember.address, true);

            await bridgeInstance.setRouterContract(routerInstance.contractAddress);
            await routerInstance.setBridgeContract(bridgeInstance.contractAddress, true);
        });

        it("Should execute mint transaction", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            const expectedCheckpoints = await bridgeInstance.totalCheckpoints();

            const feesAccruedForCheckpointBeforeMint = await bridgeInstance.checkpointServiceFeesAccrued(expectedCheckpoints);

            await routerInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], bridgeInstance.contractAddress);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            assert(balanceOFReciever.eq(amount.sub(txCost).sub(expectedMintServiceFee)));

            const aliceBalance = await bridgeInstance.claimableFeesFor(aliceMember.address);

            assert(aliceBalance.eq(expectedMintServiceFee.div(3).add(txCost)));

            const bobBalance = await bridgeInstance.claimableFeesFor(bobMember.address);
            assert(bobBalance.eq(expectedMintServiceFee.div(3)));

            const carlBalance = await bridgeInstance.claimableFeesFor(carlMember.address);
            assert(carlBalance.eq(expectedMintServiceFee.div(3)));

            const totalClaimableFees = await bridgeInstance.totalClaimableFees();

            assert(totalClaimableFees.eq(expectedMintServiceFee.add(txCost)));

            const totalCheckpoints = await bridgeInstance.totalCheckpoints();
            assert(expectedCheckpoints.eq(totalCheckpoints));

            const expectedFeesAccruedForCheckpoint = feesAccruedForCheckpointBeforeMint.add(expectedMintServiceFee);
            const feesAccruedForCheckpointAfterMint = await bridgeInstance.checkpointServiceFeesAccrued(totalCheckpoints);
            assert(expectedFeesAccruedForCheckpoint.eq(feesAccruedForCheckpointAfterMint));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            assert.ok(isExecuted);
        });

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);


            await routerInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], bridgeInstance.contractAddress);

            const expectedRevertMessage = "Bridge: txId already submitted";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], bridgeInstance.contractAddress), expectedRevertMessage);
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: Invalid number of signatures";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature], bridgeInstance.contractAddress), expectedRevertMessage);
        });

        it("Should not execute mint transaction from other than a member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Governance: msg.sender is not a member";
            await assert.revertWith(routerInstance.mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature], bridgeInstance.contractAddress), expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const nonMemberSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: invalid signer";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, nonMemberSignature], bridgeInstance.contractAddress), expectedRevertMessage);
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: signature already set";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, aliceSignature], bridgeInstance.contractAddress), expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: invalid signer";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, receiver, wrongAmount, txCost, [aliceSignature, bobSignature], bridgeInstance.contractAddress), expectedRevertMessage);
        });

    });

    describe("Burn", function () {

        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            const aliceBalance = await bridgeInstance.claimableFeesFor(aliceMember.address);
            const bobBalance = await bridgeInstance.claimableFeesFor(bobMember.address);
            const carlBalance = await bridgeInstance.claimableFeesFor(carlMember.address);
            const totalClaimableFees = await bridgeInstance.totalClaimableFees();

            const expectedTotalCheckpoints = await bridgeInstance.totalCheckpoints();
            const feesAccruedForCheckpointBeforeMint = await bridgeInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);

            await routerInstance.from(nonMember).burn(amountToBurn, hederaAddress, bridgeInstance.contractAddress);

            const balanceOFRecieverAfter = await whbarInstance.balanceOf(receiver);
            const aliceBalanceAfter = await bridgeInstance.claimableFeesFor(aliceMember.address);
            const bobBalanceAfter = await bridgeInstance.claimableFeesFor(bobMember.address);
            const carlBalanceAfter = await bridgeInstance.claimableFeesFor(carlMember.address);
            const totalClaimableFeesAfter = await bridgeInstance.totalClaimableFees();

            const feeAmount = amountToBurn.mul(serviceFee).div(precision);
            const feesAccruedForCheckpointAfterMint = await bridgeInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);

            assert(balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn)));
            assert(aliceBalanceAfter.eq(aliceBalance.add(feeAmount.div(3))));
            assert(bobBalanceAfter.eq(bobBalance.add(feeAmount.div(3))));
            assert(carlBalanceAfter.eq(carlBalance.add(feeAmount.div(3))));

            assert(totalClaimableFeesAfter.eq(totalClaimableFees.add(feeAmount)));
            assert(feesAccruedForCheckpointAfterMint.eq(feesAccruedForCheckpointBeforeMint.add(feeAmount)));
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const invalidHederaAddress = [];

            const expectedRevertMessage = "BridgeRouter: invalid receiver value";
            await assert.revertWith(routerInstance.from(nonMember).burn(amountToBurn, invalidHederaAddress, bridgeInstance.contractAddress), expectedRevertMessage);
        });

        it("Should revert if called with invalid bridge address", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const notValidBridge = accounts[7].signer.address;
            const expectedRevertMessage = "BridgeRouter: invalid bridge address";
            await assert.revertWith(routerInstance.from(nonMember).burn(amountToBurn, hederaAddress, notValidBridge), expectedRevertMessage);
        });
    });

    describe("Claim and Deprecate bridge", function () {

        beforeEach(async () => {
            await updateMembersAndMint();
        });

        describe("Claim", function () {
            it("Should claim service fees", async () => {
                const expectedServiceFeePerMember = expectedMintServiceFee.div(await routerInstance.membersCount());
                let expectedTotalCheckpoints = 0;
                const totalAmount = await bridgeInstance.totalClaimableFees();

                const tokensTotalSupply = await whbarInstance.totalSupply();
                const expectedTotalSupply = amount.sub(txCost).sub(amount.sub(txCost).mul(serviceFee).div(precision));
                assert(tokensTotalSupply.eq(expectedTotalSupply));

                const nonMemberClaimableFees = await bridgeInstance.claimableFeesFor(nonMember.address);
                assert(nonMemberClaimableFees.eq(0));

                assert(totalAmount.eq(txCost.add(expectedMintServiceFee)));

                const totalCheckpoints = await bridgeInstance.totalCheckpoints();
                assert(totalCheckpoints.eq(expectedTotalCheckpoints));

                let feesAccruedForCheckpoint = await bridgeInstance.checkpointServiceFeesAccrued(0);
                assert(feesAccruedForCheckpoint.eq(expectedMintServiceFee));

                let aliceClaimableFees = await bridgeInstance.claimableFeesFor(aliceMember.address);
                let bobClaimableFees = await bridgeInstance.claimableFeesFor(bobMember.address);
                let carlClaimableFees = await bridgeInstance.claimableFeesFor(carlMember.address);

                assert(aliceClaimableFees.eq(txCost.add(expectedServiceFeePerMember)));
                assert(bobClaimableFees.eq(expectedServiceFeePerMember));
                assert(carlClaimableFees.eq(expectedServiceFeePerMember));

                // Alice
                await bridgeInstance.from(aliceMember.address).claim(txCost.add(expectedMintServiceFee.div(3)));
                expectedTotalCheckpoints++;

                const aliceBalance = await whbarInstance.balanceOf(aliceMember.address);

                const expectedAliceBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3).add(txCost);
                assert(aliceBalance.eq(expectedAliceBalance));

                let claimableFeesLeft = await bridgeInstance.claimableFees(aliceMember.address);
                assert(claimableFeesLeft.eq(0));

                let totalAmountLeft = await bridgeInstance.totalClaimableFees();
                assert(totalAmountLeft.eq(totalAmount.sub(aliceBalance)));

                const totalCheckpointsAfterAliceClaim = await bridgeInstance.totalCheckpoints();
                assert(totalCheckpointsAfterAliceClaim.eq(expectedTotalCheckpoints));

                bobClaimableFees = await bridgeInstance.claimableFeesFor(bobMember.address);
                carlClaimableFees = await bridgeInstance.claimableFeesFor(carlMember.address);

                assert(bobClaimableFees.eq(expectedMintServiceFee.div(3)));
                assert(carlClaimableFees.eq(expectedMintServiceFee.div(3)));

                feesAccruedForCheckpoint = await bridgeInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);
                assert(feesAccruedForCheckpoint.eq(0));

                // Bob
                await bridgeInstance.from(bobMember.address).claim(expectedServiceFeePerMember);
                const bobBalance = await whbarInstance.balanceOf(bobMember.address);

                const expectedBobBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(bobBalance.eq(expectedBobBalance));

                const totalCheckpointsAfterBobClaim = await bridgeInstance.totalCheckpoints();
                assert(totalCheckpointsAfterBobClaim.eq(expectedTotalCheckpoints));

                claimableFeesLeft = await bridgeInstance.claimableFeesFor(bobMember.address);
                assert(claimableFeesLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalClaimableFees();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance)));

                carlClaimableFees = await bridgeInstance.claimableFeesFor(carlMember.address);
                assert(carlClaimableFees.eq(expectedMintServiceFee.div(3)));

                feesAccruedForCheckpoint = await bridgeInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);
                assert(feesAccruedForCheckpoint.eq(0));

                // Carl
                await bridgeInstance.from(carlMember.address).claim(expectedServiceFeePerMember);
                const carlBalance = await whbarInstance.balanceOf(carlMember.address);

                const expectedCarlBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(carlBalance.eq(expectedCarlBalance));

                claimableFeesLeft = await bridgeInstance.claimableFeesFor(carlMember.address);
                assert(claimableFeesLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalClaimableFees();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance).sub(carlBalance)));

                const newTokensTotalSupply = await whbarInstance.totalSupply();
                assert(newTokensTotalSupply.eq(expectedTotalSupply.add(aliceBalance).add(bobBalance).add(carlBalance)));

                const totalCheckpointsAfterCarlClaim = await bridgeInstance.totalCheckpoints();
                assert(totalCheckpointsAfterCarlClaim.eq(expectedTotalCheckpoints));

                feesAccruedForCheckpoint = await bridgeInstance.checkpointServiceFeesAccrued(expectedTotalCheckpoints);
                assert(feesAccruedForCheckpoint.eq(0));
            });

            it("Should emit claim event", async () => {
                const expectedEvent = "Claim";
                await assert.emit(bridgeInstance.from(aliceMember.address).claim(txCost), expectedEvent);
            });

            it("Should emit claim event arguments", async () => {
                const expectedEvent = "Claim";
                await assert.emitWithArgs(
                    bridgeInstance.from(aliceMember.address).claim(txCost),
                    expectedEvent,
                    [
                        aliceMember.address,
                        txCost
                    ]);
            });

            it("Should revertWith if user without balance tries to claim", async () => {
                const expectedRevertMessage = "Bridge: msg.sender has nothing to claim";
                await assert.revertWith(bridgeInstance.from(nonMember.address).claim(txCost), expectedRevertMessage);
            });

            it("Should be able to claim after member is removed", async () => {
                await routerInstance.updateMember(aliceMember.address, false);
                await bridgeInstance.from(aliceMember.address).claim(txCost.add(expectedMintServiceFee.div(3)));
                const aliceBalance = await whbarInstance.balanceOf(aliceMember.address);

                const expectedAliceBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3).add(txCost);
                assert(aliceBalance.eq(expectedAliceBalance));

                let claimableFeesLeft = await bridgeInstance.claimableFees(aliceMember.address);
                assert(claimableFeesLeft.eq(0));
            });
        });

        describe("Deprecate", function () {

            it("Should allow members to claim when deprecated", async () => {
                const expectedServiceFeePerMember = expectedMintServiceFee.div(await routerInstance.membersCount());
                await routerInstance.deprecate(bridgeInstance.contractAddress);

                const expextedTotalSupply = amount;
                let tokensTotalSupply = await whbarInstance.totalSupply();
                assert(tokensTotalSupply.eq(expextedTotalSupply));

                const totalAmount = await bridgeInstance.totalClaimableFees();

                // Alice
                await bridgeInstance.from(aliceMember.address).claim(txCost.add(expectedServiceFeePerMember));

                const aliceBalance = await whbarInstance.balanceOf(aliceMember.address);

                const expectedAliceBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3).add(txCost);
                assert(aliceBalance.eq(expectedAliceBalance));

                let memberFeesLeft = await bridgeInstance.claimableFees(aliceMember.address);
                assert(memberFeesLeft.eq(0));

                let totalAmountLeft = await bridgeInstance.totalClaimableFees();
                assert(totalAmountLeft.eq(totalAmount.sub(aliceBalance)));

                // Bob
                await bridgeInstance.from(bobMember.address).claim(expectedServiceFeePerMember);
                const bobBalance = await whbarInstance.balanceOf(bobMember.address);

                const expectedBobBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(bobBalance.eq(expectedBobBalance));

                memberFeesLeft = await bridgeInstance.claimableFees(bobMember.address);
                assert(memberFeesLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalClaimableFees();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance)));

                // Carl
                await bridgeInstance.from(carlMember.address).claim(expectedServiceFeePerMember);
                const carlBalance = await whbarInstance.balanceOf(carlMember.address);

                const expectedCarlBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(carlBalance.eq(expectedCarlBalance));

                memberFeesLeft = await bridgeInstance.claimableFees(carlMember.address);
                assert(memberFeesLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalClaimableFees();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance).sub(carlBalance)));

                tokensTotalSupply = await whbarInstance.totalSupply();
                assert(tokensTotalSupply.eq(expextedTotalSupply));
            });

            it("Should not allow mint transaction if deprecated", async () => {
                await routerInstance.deprecate(bridgeInstance.contractAddress);
                const newTransactionId = ethers.utils.formatBytes32String("0.0.0000-0000000000-000000001");

                const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [newTransactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
                const hashMsg = ethers.utils.keccak256(encodeData);
                const hashData = ethers.utils.arrayify(hashMsg);

                const aliceSignature = await aliceMember.signMessage(hashData);
                const bobSignature = await bobMember.signMessage(hashData);
                const carlSignature = await carlMember.signMessage(hashData);


                const expectedRevertMessage = "Pausable: paused";
                await assert.revertWith(routerInstance.from(aliceMember).mint(newTransactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], bridgeInstance.contractAddress), expectedRevertMessage);
            });
        });
    });

    describe("Checkpoints", async () => {
        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should properly diststribute fees upon member change", async () => {
            const beforeUpdateCheckpoints = await bridgeInstance.totalCheckpoints();
            const expectedServiceFeePerMember = expectedMintServiceFee.div(await routerInstance.membersCount());

            await routerInstance.updateMember(aliceMember.address, false);

            const afterUpdateCheckpoints = await bridgeInstance.totalCheckpoints();
            assert(afterUpdateCheckpoints.eq(beforeUpdateCheckpoints.add(1)));

            const totalFeesForNewCheckpoint = await bridgeInstance.checkpointServiceFeesAccrued(afterUpdateCheckpoints);
            assert(totalFeesForNewCheckpoint.eq(0));

            const aliceClaimableFees = await bridgeInstance.claimableFees(aliceMember.address);
            const aliceTotalClaimableFees = await bridgeInstance.claimableFeesFor(aliceMember.address);
            assert(aliceClaimableFees.eq(txCost.add(expectedServiceFeePerMember)));
            assert(aliceClaimableFees.eq(aliceTotalClaimableFees));

            const bobClaimableFees = await bridgeInstance.claimableFees(bobMember.address);
            const bobTotalClaimableFees = await bridgeInstance.claimableFeesFor(bobMember.address);
            assert(bobClaimableFees.eq(expectedServiceFeePerMember));
            assert(bobTotalClaimableFees.eq(bobClaimableFees));

            const carolClaimableFees = await bridgeInstance.claimableFees(carlMember.address);
            const carolTotalClaimableFees = await bridgeInstance.claimableFeesFor(carlMember.address);
            assert(carolClaimableFees.eq(expectedServiceFeePerMember));
            assert(carolTotalClaimableFees.eq(carolClaimableFees));
        });

        it("Should not update checkpoints twice after consecutive update and claim", async () => {
            const beforeUpdateCheckpoints = await bridgeInstance.totalCheckpoints();
            const expectedCheckpoints = beforeUpdateCheckpoints.add(1);

            await routerInstance.updateMember(aliceMember.address, false);

            const afterUpdateCheckpoints = await bridgeInstance.totalCheckpoints();
            assert(afterUpdateCheckpoints.eq(expectedCheckpoints));

            await bridgeInstance.from(aliceMember.address).claim(await bridgeInstance.claimableFeesFor(aliceMember.address));

            const afterClaimCheckpoints = await bridgeInstance.totalCheckpoints();
            assert(afterClaimCheckpoints.eq(expectedCheckpoints));
        });

        it("Should leave leftovers in next checkpoint", async () => {
            const membersCount = await routerInstance.membersCount();
            const additionalAmount = ethers.utils.parseEther("1");
            const newTxCost = ethers.utils.parseEther("0.5");
            const nexTxId = "0x1234";

            const expectedAdditionalMintServiceFee = additionalAmount
                .sub(newTxCost)
                .mul(serviceFee)
                .div(precision);
            const expectedTotalClaimableFeesAfterAdditionalMint = txCost
                .add(newTxCost)
                .add(expectedMintServiceFee)
                .add(expectedAdditionalMintServiceFee);

            const expectedCheckpointServiceFeesAccrued = expectedAdditionalMintServiceFee
                .add(expectedMintServiceFee);

            const checkpointServiceFeesPerMember = expectedCheckpointServiceFeesAccrued.div(membersCount);

            const expectedLeftoversForNewCheckpoint = expectedCheckpointServiceFeesAccrued
                .sub(
                    checkpointServiceFeesPerMember
                        .mul(membersCount)
                );

            const encodeData = ethers.utils.defaultAbiCoder
                .encode(["bytes", "address", "uint256", "uint256", "address"], [nexTxId, receiver, additionalAmount, newTxCost, bridgeInstance.contractAddress]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.from(aliceMember).mint(nexTxId, receiver, additionalAmount, newTxCost, [aliceSignature, bobSignature, carlSignature], bridgeInstance.contractAddress);

            const totalClaimableFees = await bridgeInstance.totalClaimableFees();
            assert(totalClaimableFees.eq(expectedTotalClaimableFeesAfterAdditionalMint));

            const totalCheckpointsBeforeUpdateMember = await bridgeInstance.totalCheckpoints();
            const feesAccruedForCheckpointBeforeUpdateMember = await bridgeInstance.checkpointServiceFeesAccrued(totalCheckpointsBeforeUpdateMember);
            assert(feesAccruedForCheckpointBeforeUpdateMember.eq(expectedCheckpointServiceFeesAccrued));

            await routerInstance.updateMember(aliceMember.address, false); // new checkpoint is created

            const totalCheckpointsAfterUpdateMember = await bridgeInstance.totalCheckpoints();
            assert(totalCheckpointsAfterUpdateMember.eq(totalCheckpointsBeforeUpdateMember.add(1)));

            const feesAccruedForPreviousCheckpoint = await bridgeInstance.checkpointServiceFeesAccrued(totalCheckpointsBeforeUpdateMember);
            assert(feesAccruedForPreviousCheckpoint.eq(feesAccruedForCheckpointBeforeUpdateMember));

            const feesAccruedForNewCheckpoint = await bridgeInstance.checkpointServiceFeesAccrued(totalCheckpointsAfterUpdateMember);
            assert(feesAccruedForNewCheckpoint.eq(expectedLeftoversForNewCheckpoint));

            const aliceTotalClaimableFees = await bridgeInstance.claimableFeesFor(aliceMember.address);

            assert(aliceTotalClaimableFees
                .eq(txCost
                    .add(newTxCost)
                    .add(checkpointServiceFeesPerMember)
                ));

            const bobTotalClaimableFees = await bridgeInstance.claimableFeesFor(bobMember.address);
            assert(bobTotalClaimableFees.eq(checkpointServiceFeesPerMember));

            const carolTotalClaimableFees = await bridgeInstance.claimableFeesFor(carlMember.address);
            assert(carolTotalClaimableFees.eq(checkpointServiceFeesPerMember));
        });
    });

    async function updateMembersAndMint() {
        await routerInstance.updateMember(aliceMember.address, true);
        await routerInstance.updateMember(bobMember.address, true);
        await routerInstance.updateMember(carlMember.address, true);

        const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256", "address"], [transactionId, receiver, amount, txCost, bridgeInstance.contractAddress]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        const hashData = ethers.utils.arrayify(hashMsg);

        const aliceSignature = await aliceMember.signMessage(hashData);
        const bobSignature = await bobMember.signMessage(hashData);
        const carlSignature = await carlMember.signMessage(hashData);

        await routerInstance.setBridgeContract(bridgeInstance.contractAddress, true);
        await bridgeInstance.setRouterContract(routerInstance.contractAddress);

        await routerInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], bridgeInstance.contractAddress);
    }
});
