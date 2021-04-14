const { expect, assert } = require("chai");

describe("Router", function () {
    this.timeout(10000);

    let Router, routerInstance, WrappedToken, wrappedTokenInstance, Controller, controllerInstance, receiver;

    const name = "WrapedHBAR";
    const symbol = "WHBAR";
    const decimals = 8;

    // 5% multiplied by 1000
    const serviceFee = "5000";

    const transactionId = ethers.utils.formatBytes32String("0.0.0000-0000000000-000000000");
    const hederaAddress = ethers.utils.formatBytes32String("0.0.0000");
    const wrappedId = ethers.utils.formatBytes32String("0.0.0001");
    const amount = ethers.utils.parseEther("100");
    const txCost = ethers.utils.parseEther("10");
    const gasprice = ethers.utils.parseUnits("150", "wei");

    const precision = 100000;
    let expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);

    beforeEach(async () => {
        [owner, aliceMember, bobMember, carlMember, nonMember, notAdmin, notValidAsset] = await ethers.getSigners();
        receiver = nonMember.address;

        Controller = await ethers.getContractFactory("Controller");
        controllerInstance = await Controller.deploy();
        await controllerInstance.deployed();

        WrappedToken = await ethers.getContractFactory("WrappedToken");
        wrappedTokenInstance = await WrappedToken.deploy(name, symbol, decimals, controllerInstance.address);
        await wrappedTokenInstance.deployed();

        Router = await ethers.getContractFactory("Router");
        routerInstance = await Router.deploy(serviceFee, controllerInstance.address);

        await controllerInstance.setRouterAddress(routerInstance.address);
    });

    describe("Contract Setup", function () {

        it("Should deploy Router contract", async () => {
            const serviceFeeSet = await routerInstance.serviceFee();
            assert(serviceFeeSet.eq(serviceFee));

            const controllerAddress = await routerInstance.controllerAddress();
            expect(controllerAddress).to.eq(controllerInstance.address);
        });

        it("Should set a member", async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            const aliceStatus = await routerInstance.isMember(aliceMember.address);
            expect(aliceStatus).to.true;
            const addressAtIndex = await routerInstance.memberAt(0);
            expect(addressAtIndex).to.eq(aliceMember.address);
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
            await expect(routerInstance.connect(notAdmin).updateMember(aliceMember.address, true)).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not set same member twice", async () => {
            const expectedRevertMessage = "Governance: Account already added";

            await routerInstance.updateMember(aliceMember.address, true);
            await expect(routerInstance.updateMember(aliceMember.address, true)).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should emit MemberUpdated event", async () => {
            const expectedEvent = "MemberUpdated";
            await expect(
                routerInstance.updateMember(
                    aliceMember.address,
                    true
                ))
                .to.emit(routerInstance, expectedEvent).withArgs(aliceMember.address, true);
        });

        it("Should remove a member", async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            let aliceStatus = await routerInstance.isMember(aliceMember.address);
            expect(aliceStatus).to.true;
            let membersCount = await routerInstance.membersCount();
            let expectedCount = 2;
            assert(membersCount.eq(expectedCount));

            await routerInstance.updateMember(aliceMember.address, false);
            aliceStatus = await routerInstance.isMember(aliceMember.address);
            expect(aliceStatus).to.false;

            membersCount = await routerInstance.membersCount();
            expectedCount = 1;
            assert(membersCount.eq(expectedCount));
        });

        it("Should not remove same member twice", async () => {
            await routerInstance.updateMember(aliceMember.address, true);

            await routerInstance.updateMember(aliceMember.address, false);

            const expectedRevertMessage = "Governance: Account is not a member";
            await expect(routerInstance.updateMember(aliceMember.address, false)).to.be.revertedWith(expectedRevertMessage);
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
            await expect(routerInstance.setServiceFee(newFee)).to.emit(routerInstance, expectedEvent).withArgs(owner.address, newFee);
        });

        it("Should not set a service fee if not from owner", async () => {
            const newFee = 7000;

            const expectedRevertMessage = "Ownable: caller is not the owner";
            await expect(routerInstance.connect(aliceMember).setServiceFee(newFee)).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revertWith if service fee is equal or above 100%", async () => {
            const newFee = precision;
            const expectedRevertMessage = "Controller: Service fee cannot exceed 100%";
            await expect(routerInstance.setServiceFee(newFee)).to.be.revertedWith(expectedRevertMessage);
        });
    });


    describe("Mint", function () {

        beforeEach(async () => {

            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            await routerInstance.updateMember(carlMember.address, true);

            await routerInstance.updateWrappedToken(wrappedTokenInstance.address, wrappedId, true);
        });

        it("Should execute mint with reimbursment transaction", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            });

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);

            assert(balanceOFReciever.eq(amount.sub(txCost).sub(expectedMintServiceFee)));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            expect(isExecuted).to.true;

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.address);
            assert(wrappedTokensData.feesAccrued.eq(expectedMintServiceFee));

            const alicetxCosts = await routerInstance.getTxCostsPerMember(wrappedTokenInstance.address, aliceMember.address);
            assert(alicetxCosts.eq(txCost));
        });

        it("Should execute mint", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.connect(aliceMember).mint(transactionId, wrappedTokenInstance.address, receiver, amount, [aliceSignature, bobSignature, carlSignature]);

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);

            expectedMintServiceFee = amount.mul(serviceFee).div(precision);

            assert(balanceOFReciever.eq(amount.sub(expectedMintServiceFee)));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            expect(isExecuted).to.true;

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.address);
            assert(wrappedTokensData.feesAccrued.eq(expectedMintServiceFee));

            const alicetxCosts = await routerInstance.getTxCostsPerMember(wrappedTokenInstance.address, aliceMember.address);
            assert(alicetxCosts.eq(0));
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await expect(routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            })).to.emit(routerInstance, expectedEvent);
        });

        it("Should execute mint transaction from not a validator", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.connect(nonMember).mint(transactionId, wrappedTokenInstance.address, receiver, amount, [aliceSignature, bobSignature, carlSignature]);

            const expectedServiceFee = amount.mul(serviceFee).div(precision);

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);
            assert(balanceOFReciever.eq(amount.sub(expectedServiceFee)));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            expect(isExecuted).to.true;
        });

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);


            await routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            });

            const expectedRevertMessage = "Router: txId already submitted";
            await expect(routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            })).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Router: Invalid number of signatures";
            await expect(routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature], {
                gasPrice: gasprice
            })).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction from other than a member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Governance: msg.sender is not a member";
            await expect(routerInstance.mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, bobSignature], {
                gasPrice: gasprice
            })).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const nonMemberSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer";
            await expect(routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, nonMemberSignature], {
                gasPrice: gasprice
            })).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Router: signature already set";
            await expect(routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, aliceSignature], {
                gasPrice: gasprice
            })).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer";
            await expect(routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, wrongAmount, txCost, [aliceSignature, bobSignature], {
                gasPrice: gasprice
            })).to.be.revertedWith(expectedRevertMessage);
        });
    });

    describe("Burn", function () {

        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.connect(nonMember).approve(controllerInstance.address, amountToBurn);

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(receiver);

            let wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.address);
            const totalClaimableFees = wrappedTokensData.feesAccrued;

            await routerInstance.connect(nonMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.address);

            const balanceOFRecieverAfter = await wrappedTokenInstance.balanceOf(receiver);

            wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.address);
            const totalClaimableFeesAfter = wrappedTokensData.feesAccrued;

            const feeAmount = amountToBurn.mul(serviceFee).div(precision);

            assert(balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn)));

            assert(totalClaimableFeesAfter.eq(totalClaimableFees.add(feeAmount)));
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.connect(nonMember).approve(controllerInstance.address, amountToBurn);

            const invalidHederaAddress = [];

            const expectedRevertMessage = "Router: invalid receiver value";
            await expect(routerInstance.connect(nonMember).burn(amountToBurn, invalidHederaAddress, wrappedTokenInstance.address)).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if called with invalid controller address", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.connect(nonMember).approve(controllerInstance.address, amountToBurn);

            const expectedRevertMessage = "Router: wrappedToken contract not active";
            await expect(routerInstance.connect(nonMember).burn(amountToBurn, hederaAddress, notValidAsset.address)).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.connect(nonMember).approve(controllerInstance.address, amountToBurn);
            const expectedServiceFee = amountToBurn.mul(serviceFee).div(precision);
            const expectedAmount = amountToBurn.sub(expectedServiceFee);

            const expectedEvent = "Burn";

            await expect(routerInstance.connect(nonMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.address))
                .to.emit(routerInstance, expectedEvent)
                .withArgs(receiver,
                    wrappedTokenInstance.address,
                    expectedAmount,
                    expectedServiceFee,
                    hederaAddress);
        });

        it("Should revert if there are no approved tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");

            const expectedRevertMessage = "ERC20: burn amount exceeds allowance";
            await expect(routerInstance.connect(nonMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.address)).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.connect(aliceMember).approve(controllerInstance.address, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await expect(routerInstance.connect(aliceMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.address)).to.be.revertedWith(expectedRevertMessage);
        });
    });

    describe("Claim fees", function () {

        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should claim service fees", async () => {
            expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);

            await routerInstance.connect(aliceMember).claim(wrappedTokenInstance.address);
            await routerInstance.connect(bobMember).claim(wrappedTokenInstance.address);
            await routerInstance.connect(carlMember).claim(wrappedTokenInstance.address);

            const aliceBalance = await wrappedTokenInstance.balanceOf(aliceMember.address);
            const bobBalance = await wrappedTokenInstance.balanceOf(bobMember.address);
            const carlBalance = await wrappedTokenInstance.balanceOf(carlMember.address);

            assert(aliceBalance.eq(expectedMintServiceFee.div(3).add(txCost)));
            assert(bobBalance.eq(expectedMintServiceFee.div(3)));
            assert(carlBalance.eq(expectedMintServiceFee.div(3)));

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.address);
            assert(wrappedTokensData.feesAccrued.eq(wrappedTokensData.previousAccrued));
            assert(wrappedTokensData.accumulator.eq(expectedMintServiceFee.div(3)));
        });

        it("Should claim multiple service fees", async () => {
            expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision).mul(2);

            const newTransactionId = ethers.utils.formatBytes32String("0.0.0000-0000000000-000000003");
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [newTransactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.connect(bobMember).mintWithReimbursement(newTransactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
                gasPrice: gasprice
            });

            await routerInstance.connect(aliceMember).claim(wrappedTokenInstance.address);
            await routerInstance.connect(bobMember).claim(wrappedTokenInstance.address);
            await routerInstance.connect(carlMember).claim(wrappedTokenInstance.address);

            const aliceBalance = await wrappedTokenInstance.balanceOf(aliceMember.address);
            const bobBalance = await wrappedTokenInstance.balanceOf(bobMember.address);
            const carlBalance = await wrappedTokenInstance.balanceOf(carlMember.address);

            assert(aliceBalance.eq(expectedMintServiceFee.div(3).add(txCost)));
            assert(bobBalance.eq(expectedMintServiceFee.div(3).add(txCost)));
            assert(carlBalance.eq(expectedMintServiceFee.div(3)));

            const wrappedTokensData = await routerInstance.wrappedTokensData(wrappedTokenInstance.address);
            assert(wrappedTokensData.feesAccrued.eq(wrappedTokensData.previousAccrued));
            assert(wrappedTokensData.accumulator.eq(expectedMintServiceFee.div(3)));
        });

        it("Should emit claim event", async () => {
            expectedMintServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);
            const expectedEvent = "Claim";
            await expect(routerInstance.connect(aliceMember).claim(wrappedTokenInstance.address))
                .to.emit(routerInstance, expectedEvent)
                .withArgs(
                    aliceMember.address,
                    txCost.add(expectedMintServiceFee.div(3))
                );
        });

        it("Should revertWith if user without balance tries to claim", async () => {
            const expectedRevertMessage = "Governance: msg.sender is not a member";
            await expect(routerInstance.connect(nonMember).claim(wrappedTokenInstance.address)).to.be.revertedWith(expectedRevertMessage);
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

        await routerInstance.updateWrappedToken(wrappedTokenInstance.address, wrappedId, true);

        const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256", "uint256", "uint256"], [transactionId, wrappedTokenInstance.address, receiver, amount, txCost, gasprice]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        const hashData = ethers.utils.arrayify(hashMsg);

        const aliceSignature = await aliceMember.signMessage(hashData);
        const bobSignature = await bobMember.signMessage(hashData);
        const carlSignature = await carlMember.signMessage(hashData);

        await routerInstance.connect(aliceMember).mintWithReimbursement(transactionId, wrappedTokenInstance.address, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature], {
            gasPrice: gasprice
        });
    }
});
