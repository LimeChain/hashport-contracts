const etherlime = require("etherlime-lib");
const Bridge = require("../build/Bridge");
const WHBAR = require("../build/WHBAR");
const ethers = require("ethers");

describe("Bridge", function () {
    this.timeout(10000);

    let owner = accounts[9];
    let aliceMember = accounts[1].signer;
    let bobMember = accounts[2].signer;
    let carlMember = accounts[3].signer;
    let nonMember = accounts[4].signer;
    let notAdmin = accounts[5].signer;

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
            serviceFee
        );

        await whbarInstance.setControllerAddress(bridgeInstance.contractAddress);
    });

    describe("Contract Setup", function () {

        it("Should deploy Bridge contract", async () => {
            assert.isAddress(
                bridgeInstance.contractAddress,
                "The contract was not deployed"
            );
            const tokenAddress = await bridgeInstance.whbarToken();
            assert.equal(tokenAddress, whbarInstance.contractAddress);
            const _serviceFee = await bridgeInstance.serviceFee();
            assert(_serviceFee.eq(serviceFee));

            const _owner = await bridgeInstance.owner();
            assert.equal(_owner, owner.signer.address);
        });

        it("Should set a member", async () => {
            await bridgeInstance.updateMember(aliceMember.address, true);
            const aliceStatus = await bridgeInstance.isMember(aliceMember.address);
            assert.ok(aliceStatus);
            const addressAtIndex = await bridgeInstance.memberAt(0);
            assert.equal(addressAtIndex, aliceMember.address);
            const membersCount = await bridgeInstance.membersCount();
            const expectedCount = 1;
            assert(membersCount.eq(expectedCount));
        });

        it("Should set multiple member", async () => {
            await bridgeInstance.updateMember(aliceMember.address, true);
            await bridgeInstance.updateMember(bobMember.address, true);
            await bridgeInstance.updateMember(carlMember.address, true);
            const aliceStatus = await bridgeInstance.isMember(aliceMember.address);
            const bobStatus = await bridgeInstance.isMember(bobMember.address);
            const carlStatus = await bridgeInstance.isMember(carlMember.address);
            assert.ok(aliceStatus);
            assert.ok(bobStatus);
            assert.ok(carlStatus);
            const membersCount = await bridgeInstance.membersCount();
            const expectedCount = 3;
            assert.equal(membersCount.toString(), expectedCount);

            const aliceAtIndex = await bridgeInstance.memberAt(0);
            assert.equal(aliceAtIndex, aliceMember.address);

            const bobAtIndex = await bridgeInstance.memberAt(1);
            assert.equal(bobAtIndex, bobMember.address);

            const carlAtIndex = await bridgeInstance.memberAt(2);
            assert.equal(carlAtIndex, carlMember.address);
        });

        it("Should not set a member if not from admin", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(bridgeInstance.from(notAdmin.address).updateMember(aliceMember.address, true), expectedRevertMessage);
        });

        it("Should not set same member twice", async () => {
            const expectedRevertMessage = "Governance: Account already added";

            await bridgeInstance.updateMember(aliceMember.address, true);
            await assert.revertWith(bridgeInstance.updateMember(aliceMember.address, true), expectedRevertMessage);
        });

        it("Should emit MemberUpdated event", async () => {
            const expectedEvent = "MemberUpdated";
            await assert.emit(
                bridgeInstance.updateMember(
                    aliceMember.address,
                    true
                ),
                expectedEvent
            );
        });

        it("Should emit MemberUpdated event arguments", async () => {
            const expectedEvent = "MemberUpdated";
            await assert.emitWithArgs(
                bridgeInstance.updateMember(
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
            await bridgeInstance.updateMember(aliceMember.address, true);
            await bridgeInstance.updateMember(bobMember.address, true);
            let aliceStatus = await bridgeInstance.isMember(aliceMember.address);
            assert.ok(aliceStatus);
            let membersCount = await bridgeInstance.membersCount();
            let expectedCount = 2;
            assert(membersCount.eq(expectedCount));

            await bridgeInstance.updateMember(aliceMember.address, false);
            aliceStatus = await bridgeInstance.isMember(aliceMember.address);
            assert.ok(!aliceStatus);

            membersCount = await bridgeInstance.membersCount();
            expectedCount = 1;
            assert(membersCount.eq(expectedCount));
        });

        it("Should not remove same member twice", async () => {
            await bridgeInstance.updateMember(aliceMember.address, true);

            await bridgeInstance.updateMember(aliceMember.address, false);

            const expectedRevertMessage = "Governance: Account is not a member";
            await assert.revertWith(bridgeInstance.updateMember(aliceMember.address, false), expectedRevertMessage);
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

            await bridgeInstance.updateMember(aliceMember.address, true);
            await bridgeInstance.updateMember(bobMember.address, true);
            await bridgeInstance.updateMember(carlMember.address, true);
        });

        it("Should execute mint transaction", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            const expectedCheckpoints = await bridgeInstance.totalCheckpoints();

            const feesAccruedForCheckpointBeforeMint = await bridgeInstance.checkpointServiceFeesAccrued(expectedCheckpoints);

            await bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]);

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

            const isExecuted = await bridgeInstance.mintTransfers(transactionId);
            assert.ok(isExecuted);
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await assert.emit(bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]), expectedEvent);
        });

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);


            await bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]);

            const expectedRevertMessage = "Bridge: txId already submitted";
            await assert.revertWith(bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: Invalid number of signatures";
            await assert.revertWith(bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction from other than a member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Governance: msg.sender is not a member";
            await assert.revertWith(bridgeInstance.mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const nonMemberSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: invalid signer";
            await assert.revertWith(bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, nonMemberSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: signature already set";
            await assert.revertWith(bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, aliceSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Bridge: invalid signer";
            await assert.revertWith(bridgeInstance.from(aliceMember).mint(transactionId, receiver, wrongAmount, txCost, [aliceSignature, bobSignature]), expectedRevertMessage);
        });

    });

    describe("Burn", function () {

        beforeEach(async () => {

            await bridgeInstance.updateMember(aliceMember.address, true);
            await bridgeInstance.updateMember(bobMember.address, true);
            await bridgeInstance.updateMember(carlMember.address, true);

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]);

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

            await bridgeInstance.from(nonMember).burn(amountToBurn, hederaAddress);

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

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emit(bridgeInstance.from(nonMember).burn(amountToBurn, hederaAddress), expectedEvent);
        });

        it("Should emit burn event arguments", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const expectedServiceFee = amountToBurn.mul(serviceFee).div(precision);
            const expectedAmount = amountToBurn.sub(expectedServiceFee);
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emitWithArgs(
                bridgeInstance.from(nonMember).burn(amountToBurn, hederaAddress),
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
            await assert.revertWith(bridgeInstance.from(nonMember).burn(amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(aliceMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await assert.revertWith(bridgeInstance.from(aliceMember).burn(amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if deprecated", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            await bridgeInstance.deprecate();

            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(bridgeInstance.from(nonMember).burn(amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonMember).approve(bridgeInstance.contractAddress, amountToBurn);

            const invalidHederaAddress = [];

            const expectedRevertMessage = "Bridge: invalid receiver value";
            await assert.revertWith(bridgeInstance.from(nonMember).burn(amountToBurn, invalidHederaAddress), expectedRevertMessage);
        });
    });

    describe("Claim and Deprecate bridge", function () {

        beforeEach(async () => {

            await bridgeInstance.updateMember(aliceMember.address, true);
            await bridgeInstance.updateMember(bobMember.address, true);
            await bridgeInstance.updateMember(carlMember.address, true);

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]);
        });

        describe("Claim", function () {
            it("Should claim service fees", async () => {
                const expectedServiceFeePerMember = expectedMintServiceFee.div(await bridgeInstance.membersCount());
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
        });

        describe("Deprecate", function () {
            it("Should deprecate Bridge", async () => {
                let isPaused = await bridgeInstance.paused();
                assert.ok(!isPaused);
                await bridgeInstance.deprecate();
                const balanceOfBridge = await whbarInstance.balanceOf(bridgeInstance.contractAddress);
                const expectedBalance = amount.sub(txCost).mul(serviceFee).div(precision).add(txCost);
                assert(balanceOfBridge.eq(expectedBalance));

                isPaused = await bridgeInstance.paused();
                assert.ok(isPaused);
            });

            it("Should emit Deprecate event", async () => {
                const expectedEvent = "Deprecate";
                await assert.emit(bridgeInstance.deprecate(), expectedEvent);
            });

            it("Should emit Deprecate event arguments", async () => {
                const expectedAmount = await bridgeInstance.totalClaimableFees();
                const expectedEvent = "Deprecate";
                await assert.emitWithArgs(
                    bridgeInstance.deprecate(),
                    expectedEvent,
                    [
                        owner.signer.address,
                        expectedAmount
                    ]);
            });

            it("Should not deprecate Bridge if already deprecated", async () => {
                await bridgeInstance.deprecate();
                const expectedRevertMessage = "Pausable: paused";
                await assert.revertWith(bridgeInstance.deprecate(), expectedRevertMessage);
            });

            it("Should not deprecate Bridge if not called from owner", async () => {
                const expectedRevertMessage = "Ownable: caller is not the owner";
                await assert.revertWith(bridgeInstance.from(aliceMember).deprecate(), expectedRevertMessage);
            });

            it("Should allow members to claim when deprecated", async () => {
                const expectedServiceFeePerMember = expectedMintServiceFee.div(await bridgeInstance.membersCount());
                await bridgeInstance.deprecate();

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
                await bridgeInstance.deprecate();

                const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
                const hashMsg = ethers.utils.keccak256(encodeData);
                const hashData = ethers.utils.arrayify(hashMsg);

                const aliceSignature = await aliceMember.signMessage(hashData);
                const bobSignature = await bobMember.signMessage(hashData);
                const carlSignature = await carlMember.signMessage(hashData);

                const expectedRevertMessage = "Pausable: paused";
                await assert.revertWith(bridgeInstance.from(aliceMember).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]), expectedRevertMessage);
            });
        });
    });
});
