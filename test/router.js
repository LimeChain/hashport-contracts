const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("Router", function () {
    let Router,
        routerInstance,
        WrappedToken,
        wrappedTokenInstance,
        Controller,
        controllerInstance,
        receiver;

    const name = "WrapedHBAR";
    const symbol = "WHBAR";
    const decimals = 8;

    const transactionId = ethers.utils.formatBytes32String(
        "0.0.0000-0000000000-000000000"
    );
    const hederaAddress = ethers.utils.formatBytes32String("0.0.0000");
    const wrappedId = ethers.utils.formatBytes32String("0.0.0001");
    const amount = ethers.utils.parseEther("100");

    beforeEach(async () => {
        [
            owner,
            aliceMember,
            bobMember,
            carlMember,
            nonMember,
            notAdmin,
            notValidAsset,
            mockAsset,
            mockNative,
        ] = await ethers.getSigners();
        receiver = nonMember.address;

        Controller = await ethers.getContractFactory("Controller");
        controllerInstance = await Controller.deploy();
        await controllerInstance.deployed();

        WrappedToken = await ethers.getContractFactory("WrappedToken");
        wrappedTokenInstance = await WrappedToken.deploy(
            name,
            symbol,
            decimals,
            controllerInstance.address
        );
        await wrappedTokenInstance.deployed();

        Router = await ethers.getContractFactory("Router");
        routerInstance = await Router.deploy(controllerInstance.address);

        await controllerInstance.setRouter(routerInstance.address);
    });

    describe("Contract Setup", function () {
        it("Should deploy Router contract", async () => {
            const controllerAddress = await routerInstance.controller();
            expect(controllerAddress).to.eq(controllerInstance.address);
        });

        it("Should revert if controller address is not valid", async () => {
            const expectedRevertMessage =
                "Router: controller address cannot be zero";
            const nonValidAddress = ethers.constants.AddressZero;
            await expect(Router.deploy(nonValidAddress)).to.be.revertedWith(
                expectedRevertMessage
            );
        });

        it("Should set a member to true", async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            const aliceStatus = await routerInstance.isMember(
                aliceMember.address
            );
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
            const aliceStatus = await routerInstance.isMember(
                aliceMember.address
            );
            const bobStatus = await routerInstance.isMember(bobMember.address);
            const carlStatus = await routerInstance.isMember(
                carlMember.address
            );
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
            await expect(
                routerInstance
                    .connect(notAdmin)
                    .updateMember(aliceMember.address, true)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not set same member twice", async () => {
            const expectedRevertMessage = "Governance: Account already added";

            await routerInstance.updateMember(aliceMember.address, true);
            await expect(
                routerInstance.updateMember(aliceMember.address, true)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should emit MemberUpdated event", async () => {
            const expectedEvent = "MemberUpdated";
            await expect(routerInstance.updateMember(aliceMember.address, true))
                .to.emit(routerInstance, expectedEvent)
                .withArgs(aliceMember.address, true);
        });

        it("Should remove a member", async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            let aliceStatus = await routerInstance.isMember(
                aliceMember.address
            );
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
            await expect(
                routerInstance.updateMember(aliceMember.address, false)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should set asset pair", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );
            const assetsCount = await routerInstance.wrappedAssetsCount();
            const expectedCount = 1;
            assert(assetsCount.eq(expectedCount));

            const wrapped = await routerInstance.nativeToWrapped(wrappedId);
            const native = await routerInstance.wrappedToNative(
                wrappedTokenInstance.address
            );
            expect(wrapped).to.eq(wrappedTokenInstance.address);
            expect(native).to.eq(wrappedId);

            const wrappedAssetAt = await routerInstance.wrappedAssetAt(0);
            expect(wrappedAssetAt).to.eq(wrappedTokenInstance.address);
        });

        it("Should emit PairAdded", async () => {
            const expectedEvent = "PairAdded";
            await expect(
                routerInstance.addPair(wrappedId, wrappedTokenInstance.address)
            )
                .to.emit(routerInstance, expectedEvent)
                .withArgs(wrappedId, wrappedTokenInstance.address);
        });

        it("Should revert if addPair is called from not owner", async () => {
            expectedRevertMessage = "Ownable: caller is not the owner";
            await expect(
                routerInstance
                    .connect(notAdmin)
                    .addPair(wrappedId, wrappedTokenInstance.address)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if addPair is called with zero native", async () => {
            expectedRevertMessage = "Router: invalid native asset";
            const nonValidId = "0x";
            await expect(
                routerInstance.addPair(nonValidId, wrappedTokenInstance.address)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if addPair is called with zero asset address", async () => {
            expectedRevertMessage = "Router: address can't be zero";
            const nonValidAddress = ethers.constants.AddressZero;
            await expect(
                routerInstance.addPair(wrappedId, nonValidAddress)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if native asset already added", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );
            expectedRevertMessage = "Router: Native asset already added";
            await expect(
                routerInstance.addPair(wrappedId, wrappedTokenInstance.address)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if wrapped token already added", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );
            expectedRevertMessage = "Router: Wrapped asset already added";
            await expect(
                routerInstance.addPair(
                    mockNative.address,
                    wrappedTokenInstance.address
                )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if add same pair twice", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );
            expectedRevertMessage = "Router: Native asset already added";
            await expect(
                routerInstance.addPair(wrappedId, wrappedTokenInstance.address)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should remove asset pair", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );
            await routerInstance.removePair(
                wrappedId,
                wrappedTokenInstance.address
            );

            const assetsCount = await routerInstance.wrappedAssetsCount();
            const expectedCount = 0;
            assert(assetsCount.eq(expectedCount));

            const addressZero = ethers.constants.AddressZero;
            const bytesZero = "0x";

            const wrapped = await routerInstance.nativeToWrapped(wrappedId);
            const native = await routerInstance.wrappedToNative(
                wrappedTokenInstance.address
            );
            expect(wrapped).to.eq(addressZero);
            expect(native).to.eq(bytesZero);
        });

        it("Should emit PairRemoved", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );
            const expectedEvent = "PairRemoved";
            await expect(
                routerInstance.removePair(
                    wrappedId,
                    wrappedTokenInstance.address
                )
            )
                .to.emit(routerInstance, expectedEvent)
                .withArgs(wrappedId, wrappedTokenInstance.address);
        });

        it("Should revert if removePair is called from not owner", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );

            expectedRevertMessage = "Ownable: caller is not the owner";
            await expect(
                routerInstance
                    .connect(notAdmin)
                    .removePair(wrappedId, wrappedTokenInstance.address)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if native asset is wrong", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );

            await routerInstance.removePair(
                wrappedId,
                wrappedTokenInstance.address
            );
            expectedRevertMessage = "Router: Invalid pair";
            await expect(
                routerInstance.removePair(wrappedId, mockAsset.address)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if wrapped token is wrong", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );

            await routerInstance.removePair(
                wrappedId,
                wrappedTokenInstance.address
            );
            expectedRevertMessage = "Router: Invalid pair";
            await expect(
                routerInstance.removePair(
                    mockNative.address,
                    wrappedTokenInstance.address
                )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if remove same pair twice", async () => {
            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );

            await routerInstance.removePair(
                wrappedId,
                wrappedTokenInstance.address
            );
            expectedRevertMessage = "Router: Invalid pair";
            await expect(
                routerInstance.removePair(
                    wrappedId,
                    wrappedTokenInstance.address
                )
            ).to.be.revertedWith(expectedRevertMessage);
        });
    });

    describe("Mint", function () {
        beforeEach(async () => {
            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            await routerInstance.updateMember(carlMember.address, true);

            await routerInstance.addPair(
                wrappedId,
                wrappedTokenInstance.address
            );
        });

        it("Should execute mint", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);
            await routerInstance
                .connect(aliceMember)
                .mint(
                    transactionId,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                    [aliceSignature, bobSignature, carlSignature]
                );

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(
                receiver
            );
            assert(balanceOFReciever.eq(amount));

            const isExecuted = await routerInstance.executedTransactions(
                transactionId
            );
            expect(isExecuted).to.true;
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";

            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature, bobSignature, carlSignature]
                    )
            ).to.emit(routerInstance, expectedEvent);
        });

        it("Should execute mint transaction from not a validator", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance
                .connect(nonMember)
                .mint(
                    transactionId,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                    [aliceSignature, bobSignature, carlSignature]
                );

            const isExecuted = await routerInstance.executedTransactions(
                transactionId
            );
            expect(isExecuted).to.true;
        });

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance
                .connect(aliceMember)
                .mint(
                    transactionId,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                    [aliceSignature, bobSignature, carlSignature]
                );

            const expectedRevertMessage = "Router: txId already submitted";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature, bobSignature, carlSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage =
                "Router: Invalid number of signatures";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction more signatures than the member count", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);
            const forthSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage =
                "Router: Invalid number of signatures";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [
                            aliceSignature,
                            bobSignature,
                            carlSignature,
                            forthSignature,
                        ]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non member on first position", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const nonMemberSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer/signature";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [nonMemberSignature, aliceSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non member on last position", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const nonMemberSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer/signature";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature, nonMemberSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Router: signature already set";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature, aliceSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data on first position", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const wrongEncodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    wrongAmount,
                ]
            );

            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );

            const wrongHashMsg = ethers.utils.keccak256(wrongEncodeData);
            const wrongHashData = ethers.utils.arrayify(wrongHashMsg);

            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(wrongHashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer/signature";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature, bobSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data on last position", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const wrongEncodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    wrongAmount,
                ]
            );

            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    routerInstance.address,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );

            const wrongHashMsg = ethers.utils.keccak256(wrongEncodeData);
            const wrongHashData = ethers.utils.arrayify(wrongHashMsg);

            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(wrongHashData);

            const expectedRevertMessage = "Router: invalid signer/signature";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature, bobSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong router address", async () => {
            const wrongWrongRouter = nonMember.address;

            const encodeData = ethers.utils.defaultAbiCoder.encode(
                ["bytes", "address", "address", "address", "uint256"],
                [
                    transactionId,
                    wrongWrongRouter,
                    wrappedTokenInstance.address,
                    receiver,
                    amount,
                ]
            );
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer/signature";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .mint(
                        transactionId,
                        wrappedTokenInstance.address,
                        receiver,
                        amount,
                        [aliceSignature, bobSignature]
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });
    });

    describe("Burn", function () {
        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance
                .connect(nonMember)
                .approve(controllerInstance.address, amountToBurn);

            const balanceOFReciever = await wrappedTokenInstance.balanceOf(
                receiver
            );

            await routerInstance
                .connect(nonMember)
                .burn(
                    amountToBurn,
                    hederaAddress,
                    wrappedTokenInstance.address
                );

            const balanceOFRecieverAfter = await wrappedTokenInstance.balanceOf(
                receiver
            );

            assert(
                balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn))
            );
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance
                .connect(nonMember)
                .approve(controllerInstance.address, amountToBurn);

            const invalidHederaAddress = [];

            const expectedRevertMessage = "Router: invalid receiver value";
            await expect(
                routerInstance
                    .connect(nonMember)
                    .burn(
                        amountToBurn,
                        invalidHederaAddress,
                        wrappedTokenInstance.address
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if called with invalid asset address", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance
                .connect(nonMember)
                .approve(controllerInstance.address, amountToBurn);

            const expectedRevertMessage = "Router: token not supported";
            await expect(
                routerInstance
                    .connect(nonMember)
                    .burn(amountToBurn, hederaAddress, notValidAsset.address)
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance
                .connect(nonMember)
                .approve(controllerInstance.address, amountToBurn);

            const expectedEvent = "Burn";

            await expect(
                routerInstance
                    .connect(nonMember)
                    .burn(
                        amountToBurn,
                        hederaAddress,
                        wrappedTokenInstance.address
                    )
            ).to.emit(routerInstance, expectedEvent);
        });

        it("Should revert if there are no approved tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");

            const expectedRevertMessage =
                "ERC20: burn amount exceeds allowance";
            await expect(
                routerInstance
                    .connect(nonMember)
                    .burn(
                        amountToBurn,
                        hederaAddress,
                        wrappedTokenInstance.address
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance
                .connect(aliceMember)
                .approve(controllerInstance.address, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await expect(
                routerInstance
                    .connect(aliceMember)
                    .burn(
                        amountToBurn,
                        hederaAddress,
                        wrappedTokenInstance.address
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });
    });

    describe("Burn with permit", function () {
        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should burn tokens", async () => {
            const balanceOFReciever = await wrappedTokenInstance.balanceOf(
                receiver
            );

            const amountToBurn = ethers.utils.parseEther("5");
            const deadline = ethers.utils.parseEther("51");
            const sender = nonMember;
            const spender = controllerInstance.address;

            const signedPermit = await createPermit(
                sender,
                spender,
                amountToBurn,
                deadline,
                wrappedTokenInstance
            );

            await routerInstance
                .connect(nonMember)
                .burnWithPermit(
                    wrappedTokenInstance.address,
                    hederaAddress,
                    amountToBurn,
                    deadline,
                    signedPermit.v,
                    signedPermit.r,
                    signedPermit.s
                );

            const balanceOFRecieverAfter = await wrappedTokenInstance.balanceOf(
                receiver
            );

            assert(
                balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn))
            );
        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const deadline = ethers.utils.parseEther("51");
            const sender = nonMember;
            const spender = controllerInstance.address;

            const signedPermit = await createPermit(
                sender,
                spender,
                amountToBurn,
                deadline,
                wrappedTokenInstance
            );
            const expectedEvent = "Burn";

            await expect(
                routerInstance
                    .connect(nonMember)
                    .burnWithPermit(
                        wrappedTokenInstance.address,
                        hederaAddress,
                        amountToBurn,
                        deadline,
                        signedPermit.v,
                        signedPermit.r,
                        signedPermit.s
                    )
            ).to.emit(routerInstance, expectedEvent);
        });

        it("Should revert if signed wrong data", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const wrongAmountToBurn = ethers.utils.parseEther("4");
            const deadline = ethers.utils.parseEther("51");
            const sender = nonMember;
            const spender = controllerInstance.address;

            const signedPermit = await createPermit(
                sender,
                spender,
                wrongAmountToBurn,
                deadline,
                wrappedTokenInstance
            );

            const expectedRevertMessage = "ERC20Permit: invalid signature";

            await expect(
                routerInstance
                    .connect(nonMember)
                    .burnWithPermit(
                        wrappedTokenInstance.address,
                        hederaAddress,
                        amountToBurn,
                        deadline,
                        signedPermit.v,
                        signedPermit.r,
                        signedPermit.s
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if deadline is passed", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const deadline = "1";
            const sender = nonMember;
            const spender = controllerInstance.address;

            const signedPermit = await createPermit(
                sender,
                spender,
                amountToBurn,
                deadline,
                wrappedTokenInstance
            );

            const expectedRevertMessage = "ERC20Permit: expired deadline";

            await expect(
                routerInstance
                    .connect(nonMember)
                    .burnWithPermit(
                        wrappedTokenInstance.address,
                        hederaAddress,
                        amountToBurn,
                        deadline,
                        signedPermit.v,
                        signedPermit.r,
                        signedPermit.s
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const invalidHederaAddress = [];

            const amountToBurn = ethers.utils.parseEther("5");
            const deadline = ethers.utils.parseEther("51");
            const sender = nonMember;
            const spender = controllerInstance.address;

            const signedPermit = await createPermit(
                sender,
                spender,
                amountToBurn,
                deadline,
                wrappedTokenInstance
            );

            const expectedRevertMessage = "Router: invalid receiver value";
            await expect(
                routerInstance
                    .connect(nonMember)
                    .burnWithPermit(
                        wrappedTokenInstance.address,
                        invalidHederaAddress,
                        amountToBurn,
                        deadline,
                        signedPermit.v,
                        signedPermit.r,
                        signedPermit.s
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });

        it("Should revert if called with invalid asset address", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            const deadline = ethers.utils.parseEther("51");
            const sender = nonMember;
            const spender = controllerInstance.address;

            const signedPermit = await createPermit(
                sender,
                spender,
                amountToBurn,
                deadline,
                wrappedTokenInstance
            );

            const expectedRevertMessage = "Router: token not supported";
            await expect(
                routerInstance
                    .connect(nonMember)
                    .burnWithPermit(
                        notValidAsset.address,
                        hederaAddress,
                        amountToBurn,
                        deadline,
                        signedPermit.v,
                        signedPermit.r,
                        signedPermit.s
                    )
            ).to.be.revertedWith(expectedRevertMessage);
        });
    });

    async function updateMembersAndMint() {
        await routerInstance.updateMember(aliceMember.address, true);
        await routerInstance.updateMember(bobMember.address, true);
        await routerInstance.updateMember(carlMember.address, true);

        await routerInstance.addPair(wrappedId, wrappedTokenInstance.address);

        const encodeData = ethers.utils.defaultAbiCoder.encode(
            ["bytes", "address", "address", "address", "uint256"],
            [
                transactionId,
                routerInstance.address,
                wrappedTokenInstance.address,
                receiver,
                amount,
            ]
        );
        const hashMsg = ethers.utils.keccak256(encodeData);
        const hashData = ethers.utils.arrayify(hashMsg);

        const aliceSignature = await aliceMember.signMessage(hashData);
        const bobSignature = await bobMember.signMessage(hashData);
        const carlSignature = await carlMember.signMessage(hashData);

        await routerInstance
            .connect(aliceMember)
            .mint(
                transactionId,
                wrappedTokenInstance.address,
                receiver,
                amount,
                [aliceSignature, bobSignature, carlSignature]
            );
    }

    async function createPermit(
        owner,
        spenderAddress,
        amount,
        deadline,
        tokenContract
    ) {
        const Permit = [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ];

        const domain = {
            name: await tokenContract.name(),
            version: "1",
            chainId: "31337",
            verifyingContract: tokenContract.address,
        };

        const message = {
            owner: owner.address,
            spender: spenderAddress,
            value: amount,
            nonce: await tokenContract.nonces(owner.address),
            deadline: deadline,
        };

        const result = await owner._signTypedData(domain, { Permit }, message);
        return {
            r: result.slice(0, 66),
            s: "0x" + result.slice(66, 130),
            v: parseInt(result.slice(130, 132), 16),
        };
    }
});
