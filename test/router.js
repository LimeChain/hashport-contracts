const etherlime = require("etherlime-lib");
const WrappedToken = require("../build/WrappedToken");
const Router = require("../build/Router");
const ethers = require("ethers");


describe("Router", function () {
    this.timeout(10000);

    let owner = accounts[9];
    let aliceMember = accounts[1].signer;
    let bobMember = accounts[2].signer;
    let carlMember = accounts[3].signer;
    let nonMember = accounts[4].signer;
    let notAdmin = accounts[5].signer;

    let routerInstance;
    let wrappedTokenInstance;

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
    const txCost = ethers.utils.parseEther("10");
    const gasprice = ethers.utils.parseUnits("150", "wei");

    const precision = 100000;
    let expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);

    beforeEach(async () => {
        deployer = new etherlime.EtherlimeGanacheDeployer(owner.secretKey);
        wrappedTokenInstance = await deployer.deploy(
            WrappedToken,
            {},
            name,
            symbol,
            decimals
        );

        routerInstance = await deployer.deploy(Router, {}, serviceFee);

        await wrappedTokenInstance.setRouterAddress(routerInstance.contractAddress);
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

        it("Should set a service fee", async () => {
            const newFee = 7000;
            await routerInstance.setServiceFee(newFee);
            const newServiceFee = await routerInstance.serviceFee();
            assert.equal(newServiceFee, newFee);
        });

        it("Should emit ServiceFeeSet event", async () => {
            const newFee = 7000;

            const expectedEvent = "ServiceFeeSet";
            await assert.emit(
                routerInstance.setServiceFee(newFee),
                expectedEvent
            );
        });

        it("Should emit ServiceFeeSet event arguments", async () => {
            const newFee = 7000;

            const expectedEvent = "ServiceFeeSet";
            await assert.emitWithArgs(
                routerInstance.setServiceFee(newFee),
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
            await assert.revertWith(routerInstance.from(aliceMember).setServiceFee(newFee), expectedRevertMessage);
        });

        it("Should revertWith if service fee is equal or above 100%", async () => {
            const newFee = precision;
            const expectedRevertMessage = "Controller: Service fee cannot exceed 100%";
            await assert.revertWith(routerInstance.setServiceFee(newFee), expectedRevertMessage);
        });
    });


    describe("Mint", function () {

        beforeEach(async () => {

            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            await routerInstance.updateMember(carlMember.address, true);

            await routerInstance.updateWrappedToken(wrappedTokenInstance.contractAddress, wrappedId, true);
        });

        it("Should execute mint with reimbursment transaction", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            });

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);

            assert(balanceOFReciever.eq(amount.sub(txCost).sub(expectedMintServiceFee)));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            assert.ok(isExecuted);

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.contractAddress);
            assert(wrappedTokensData.feesAccrued.eq(expectedMintServiceFee));

            const alicetxCosts = await routerInstance.getTxCostsPerMember(wrappedTokenInstance.contractAddress, aliceMember.address);
            assert(alicetxCosts.eq(txCost));
        });

        it("Should execute mint", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature, bobSignature, carlSignature]);

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);

            expectedMintServiceFee = amount.mul(serviceFee).div(precision);

            assert(balanceOFReciever.eq(amount.sub(expectedMintServiceFee)));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            assert.ok(isExecuted);

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.contractAddress);
            assert(wrappedTokensData.feesAccrued.eq(expectedMintServiceFee));

            const alicetxCosts = await routerInstance.getTxCostsPerMember(wrappedTokenInstance.contractAddress, aliceMember.address);
            assert(alicetxCosts.eq(0));
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await assert.emit(routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            }), expectedEvent);
        });

        it("Should execute mint transaction from not a validator", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.from(nonMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature, bobSignature, carlSignature]);

            const expectedServiceFee = amount.mul(serviceFee).div(precision);

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);
            assert(balanceOFReciever.eq(amount.sub(expectedServiceFee)));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            assert.ok(isExecuted);
        });

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);


            await routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            });

            const expectedRevertMessage = "Router: txId already submitted";
            await assert.revertWith(routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            }), expectedRevertMessage);
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Router: Invalid number of signatures";
            await assert.revertWith(routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature], {
                gasPrice: gasprice
            }), expectedRevertMessage);
        });

        it("Should not execute mint transaction from other than a member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Governance: msg.sender is not a member";
            await assert.revertWith(routerInstance.mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, bobSignature], {
                gasPrice: gasprice
            }), expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const nonMemberSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer";
            await assert.revertWith(routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, nonMemberSignature], {
                gasPrice: gasprice
            }), expectedRevertMessage);
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Router: signature already set";
            await assert.revertWith(routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, aliceSignature], {
                gasPrice: gasprice
            }), expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer";
            await assert.revertWith(routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, wrongAmount, txCost, [aliceSignature, bobSignature], {
                gasPrice: gasprice
            }), expectedRevertMessage);
        });
    });

    describe("Burn", function () {

        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(nonMember).approve(routerInstance.contractAddress, amountToBurn);

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);

            let wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.contractAddress);
            const totalClaimableFees = wrappedTokensData.feesAccrued;

            await routerInstance.from(nonMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress);

            const balanceOFRecieverAfter = await wrappedTokenInstance.balanceOf(receiver);

            wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.contractAddress);
            const totalClaimableFeesAfter = wrappedTokensData.feesAccrued;

            const feeAmount = amountToBurn.mul(serviceFee).div(precision);

            assert(balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn)));

            assert(totalClaimableFeesAfter.eq(totalClaimableFees.add(feeAmount)));
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(nonMember).approve(routerInstance.contractAddress, amountToBurn);

            const invalidHederaAddress = [];

            const expectedRevertMessage = "Router: invalid receiver value";
            await assert.revertWith(routerInstance.from(nonMember).burn(amountToBurn, invalidHederaAddress, wrappedTokenInstance.contractAddress), expectedRevertMessage);
        });

        it("Should revert if called with invalid controller address", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(nonMember).approve(routerInstance.contractAddress, amountToBurn);

            const notValidAsset = accounts[7].signer.address;
            const expectedRevertMessage = "Router: wrappedToken contract not active";
            await assert.revertWith(routerInstance.from(nonMember).burn(amountToBurn, hederaAddress, notValidAsset), expectedRevertMessage);
        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(nonMember).approve(routerInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emit(routerInstance.from(nonMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress), expectedEvent);
        });

        it("Should emit burn event arguments", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const expectedServiceFee = amountToBurn.mul(serviceFee).div(precision);
            const expectedAmount = amountToBurn.sub(expectedServiceFee);
            await wrappedTokenInstance.from(nonMember).approve(routerInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emitWithArgs(
                routerInstance.from(nonMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress),
                expectedEvent,
                [
                    receiver,
                    expectedAmount,
                    expectedServiceFee,
                    hederaAddress
                ]);
        });

        it("Should revert if there are no approved tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");

            const expectedRevertMessage = "ERC20: burn amount exceeds allowance";
            await assert.revertWith(routerInstance.from(nonMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress), expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(aliceMember).approve(routerInstance.contractAddress, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await assert.revertWith(routerInstance.from(aliceMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress), expectedRevertMessage);
        });
    });

    describe("Claim fees", function () {

        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should claim service fees", async () => {
            expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);

            await routerInstance.from(aliceMember.address).claim(wrappedTokenInstance.contractAddress);
            await routerInstance.from(bobMember.address).claim(wrappedTokenInstance.contractAddress);
            await routerInstance.from(carlMember.address).claim(wrappedTokenInstance.contractAddress);

            const aliceBalance = await wrappedTokenInstance.balanceOf(aliceMember.address);
            const bobBalance = await wrappedTokenInstance.balanceOf(bobMember.address);
            const carlBalance = await wrappedTokenInstance.balanceOf(carlMember.address);

            assert(aliceBalance.eq(expectedMintServiceFee.div(3).add(txCost)));
            assert(bobBalance.eq(expectedMintServiceFee.div(3)));
            assert(carlBalance.eq(expectedMintServiceFee.div(3)));

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.contractAddress);
            assert(wrappedTokensData.feesAccrued.eq(wrappedTokensData.previousAccrued));
            assert(wrappedTokensData.accumulator.eq(expectedMintServiceFee.div(3)));
        });

        it("Should claim multiple service fees", async () => {
            expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision).mul(2);

            const newTransactionId = ethers.utils.formatBytes32String("0.0.0000-0000000000-000000003");
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [newTransactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.from(bobMember).mintWithReimbursement(newTransactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            });

            await routerInstance.from(aliceMember.address).claim(wrappedTokenInstance.contractAddress);
            await routerInstance.from(bobMember.address).claim(wrappedTokenInstance.contractAddress);
            await routerInstance.from(carlMember.address).claim(wrappedTokenInstance.contractAddress);

            const aliceBalance = await wrappedTokenInstance.balanceOf(aliceMember.address);
            const bobBalance = await wrappedTokenInstance.balanceOf(bobMember.address);
            const carlBalance = await wrappedTokenInstance.balanceOf(carlMember.address);

            assert(aliceBalance.eq(expectedMintServiceFee.div(3).add(txCost)));
            assert(bobBalance.eq(expectedMintServiceFee.div(3).add(txCost)));
            assert(carlBalance.eq(expectedMintServiceFee.div(3)));

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.contractAddress);
            assert(wrappedTokensData.feesAccrued.eq(wrappedTokensData.previousAccrued));
            assert(wrappedTokensData.accumulator.eq(expectedMintServiceFee.div(3)));
        });

        it("Should emit claim event", async () => {
            const expectedEvent = "Claim";
            await assert.emit(routerInstance.from(aliceMember.address).claim(wrappedTokenInstance.contractAddress), expectedEvent);
        });

        it("Should emit claim event arguments", async () => {
            expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);
            const expectedEvent = "Claim";
            await assert.emitWithArgs(
                routerInstance.from(aliceMember.address).claim(wrappedTokenInstance.contractAddress),
                expectedEvent,
                [
                    aliceMember.address,
                    txCost.add(expectedMintServiceFee.div(3))
                ]);
        });

        it("Should revertWith if user without balance tries to claim", async () => {
            const expectedRevertMessage = "Governance: msg.sender is not a member";
            await assert.revertWith(routerInstance.from(nonMember).claim(wrappedTokenInstance.contractAddress), expectedRevertMessage);
        });

        it("Should be able to claim after member is removed", async () => {
            await routerInstance.updateMember(aliceMember.address, false);
            const aliceBalance = await wrappedTokenInstance.balanceOf(aliceMember.address);

            const expectedAliceBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3).add(txCost);
            assert(aliceBalance.eq(expectedAliceBalance));
        });
    });

    async function updateMembersAndMint() {
        await routerInstance.updateMember(aliceMember.address, true);
        await routerInstance.updateMember(bobMember.address, true);
        await routerInstance.updateMember(carlMember.address, true);

        await routerInstance.updateWrappedToken(wrappedTokenInstance.contractAddress, wrappedId, true);

        const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, gasprice]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        const hashData = ethers.utils.arrayify(hashMsg);

        const aliceSignature = await aliceMember.signMessage(hashData);
        const bobSignature = await bobMember.signMessage(hashData);
        const carlSignature = await carlMember.signMessage(hashData);

        await routerInstance.from(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
            gasPrice: gasprice
        });
    }
});
