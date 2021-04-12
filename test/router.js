const etherlime = require("etherlime-lib");
const WrappedToken = require("../build/WrappedToken");
const Router = require("../build/Router");
const Controller = require("../build/Controller.json");
const ethers = require("ethers");


describe("Router", function () {
    this.timeout(10000);

    let owner = accounts[9];
    let aliceMember = accounts[1].signer;
    let bobMember = accounts[2].signer;
    let carlMember = accounts[3].signer;
    let nonMember = accounts[4].signer;
    let sender = accounts[5].signer;
    let notAdmin = accounts[6].signer;

    let routerInstance;
    let wrappedTokenInstance;

    const name = "WrapedHBAR";
    const symbol = "WHBAR";
    const decimals = 8;

    const transactionId = ethers.utils.formatBytes32String("0.0.0000-0000000000-000000000");
    const hederaAddress = ethers.utils.formatBytes32String("0.0.0000");
    const wrappedId = ethers.utils.formatBytes32String("0.0.0001");
    const receiver = nonMember.address;
    const amount = ethers.utils.parseEther("100");

    beforeEach(async () => {
        deployer = new etherlime.EtherlimeGanacheDeployer(owner.secretKey);
        wrappedTokenInstance = await deployer.deploy(
            WrappedToken,
            {},
            name,
            symbol,
            decimals
        );

        controllerInstance = await deployer.deploy(Controller);

        routerInstance = await deployer.deploy(Router, {},controllerInstance.contractAddress);

        await wrappedTokenInstance.setController(controllerInstance.contractAddress);
        await controllerInstance.setRouter(routerInstance.contractAddress);
    });

    describe("Contract Setup", function () {

        it("Should deploy Router contract", async () => {
            assert.isAddress(
                routerInstance.contractAddress,
                "The contract was not deployed"
            );

            const controller = await routerInstance.controller();
            assert.equal(controller, controllerInstance.contractAddress);
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

    });


    describe("Mint", function () {

        beforeEach(async () => {

            await routerInstance.updateMember(aliceMember.address, true);
            await routerInstance.updateMember(bobMember.address, true);
            await routerInstance.updateMember(carlMember.address, true);

            await routerInstance.addPair(wrappedId, wrappedTokenInstance.contractAddress);
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
            assert(balanceOFReciever.eq(amount));

            const isExecuted = await routerInstance.mintTransfers(transactionId);
            assert.ok(isExecuted);
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await assert.emit(routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature, bobSignature, carlSignature]), expectedEvent);
        });

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);
            const carlSignature = await carlMember.signMessage(hashData);

            await routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature, bobSignature, carlSignature]);

            const expectedRevertMessage = "Router: txId already submitted";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature, bobSignature, carlSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Router: Invalid number of signatures";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non member", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const nonMemberSignature = await nonMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature, nonMemberSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);

            const expectedRevertMessage = "Router: signature already set";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, amount, [aliceSignature, aliceSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, receiver, amount]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceMember.signMessage(hashData);
            const bobSignature = await bobMember.signMessage(hashData);

            const expectedRevertMessage = "Router: invalid signer";
            await assert.revertWith(routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, receiver, wrongAmount, [aliceSignature, bobSignature]), expectedRevertMessage);
        });
    });

    describe("Burn", function () {

        beforeEach(async () => {
            await updateMembersAndMint();
        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(sender).approve(controllerInstance.contractAddress, amountToBurn);
            const balanceOfSender = await wrappedTokenInstance.balanceOf(sender.address);

            await routerInstance.from(sender).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress);
            const balanceOfSenderAfter = await wrappedTokenInstance.balanceOf(sender.address);
            assert(balanceOfSenderAfter.eq(balanceOfSender.sub(amountToBurn)));
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(sender).approve(controllerInstance.contractAddress, amountToBurn);

            const invalidHederaAddress = [];

            const expectedRevertMessage = "Router: invalid receiver value";
            await assert.revertWith(routerInstance.from(sender).burn(amountToBurn, invalidHederaAddress, wrappedTokenInstance.contractAddress), expectedRevertMessage);
        });

        it("Should revert if called with invalid controller address", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(sender).approve(controllerInstance.contractAddress, amountToBurn);

            const notValidAsset = accounts[7].signer.address;
            const expectedRevertMessage = "Router: token not supported";
            await assert.revertWith(routerInstance.from(sender).burn(amountToBurn, hederaAddress, notValidAsset), expectedRevertMessage);
        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(sender).approve(controllerInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emit(routerInstance.from(sender).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress), expectedEvent);
        });

        it("Should emit burn event arguments", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(sender).approve(controllerInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emitWithArgs(
                routerInstance.from(sender).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress),
                expectedEvent,
                [
                    sender.address,
                    wrappedTokenInstance.contractAddress,
                    amountToBurn,
                    hederaAddress
                ]);
        });

        it("Should revert if there are no approved tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");

            const expectedRevertMessage = "ERC20: burn amount exceeds allowance";
            await assert.revertWith(routerInstance.from(sender).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress), expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await wrappedTokenInstance.from(aliceMember).approve(controllerInstance.contractAddress, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await assert.revertWith(routerInstance.from(aliceMember).burn(amountToBurn, hederaAddress, wrappedTokenInstance.contractAddress), expectedRevertMessage);
        });
    });

    async function updateMembersAndMint() {
        await routerInstance.updateMember(aliceMember.address, true);
        await routerInstance.updateMember(bobMember.address, true);
        await routerInstance.updateMember(carlMember.address, true);

        await routerInstance.addPair(wrappedId, wrappedTokenInstance.contractAddress);

        const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "address", "uint256"], [transactionId, wrappedTokenInstance.contractAddress, sender.address, amount]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        const hashData = ethers.utils.arrayify(hashMsg);

        const aliceSignature = await aliceMember.signMessage(hashData);
        const bobSignature = await bobMember.signMessage(hashData);
        const carlSignature = await carlMember.signMessage(hashData);

        await routerInstance.from(aliceMember).mint(transactionId, wrappedTokenInstance.contractAddress, sender.address, amount, [aliceSignature, bobSignature, carlSignature]);
    }
});
