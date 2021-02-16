const etherlime = require("etherlime-lib");
const Bridge = require("../build/Bridge");
const WHBAR = require("../build/WHBAR");
const ethers = require("ethers");

describe("Bridge", function () {
    this.timeout(10000);

    let owner = accounts[9];
    let aliceCustodian = accounts[1].signer;
    let bobCustodian = accounts[2].signer;
    let carlCustodian = accounts[3].signer;
    let nonCustodian = accounts[4].signer;
    let notAdmin = accounts[5].signer;

    let bridgeInstance;
    let whbarInstance;

    const name = "WrapedHBAR";
    const symbol = "WHBAR";
    const decimals = 8;

    // 5% multiplied by 1000
    const serviceFee = "5000";

    const transactionId = "0x123";
    const hederaAddress = "0x234";
    const receiver = nonCustodian.address;
    const amount = ethers.utils.parseEther("100");
    const txCost = ethers.utils.parseEther("1");
    const precision = 100000;


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

        it("Should set a custodian", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            const aliceStatus = await bridgeInstance.isCustodian(aliceCustodian.address);
            assert.ok(aliceStatus);
            const addressAtIndex = await bridgeInstance.custodianAddress(0);
            assert.equal(addressAtIndex, aliceCustodian.address);
            const custodianCount = await bridgeInstance.custodianCount();
            const expectedCount = 1;
            assert(custodianCount.eq(expectedCount));
        });

        it("Should set multiple custodians", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await bridgeInstance.setCustodian(bobCustodian.address, true);
            await bridgeInstance.setCustodian(carlCustodian.address, true);
            const aliceStatus = await bridgeInstance.isCustodian(aliceCustodian.address);
            const bobStatus = await bridgeInstance.isCustodian(bobCustodian.address);
            const carlStatus = await bridgeInstance.isCustodian(carlCustodian.address);
            assert.ok(aliceStatus);
            assert.ok(bobStatus);
            assert.ok(carlStatus);
            const custodiansCount = await bridgeInstance.custodianCount();
            const expectedCount = 3;
            assert.equal(custodiansCount.toString(), expectedCount);

            const aliceAtIndex = await bridgeInstance.custodianAddress(0);
            assert.equal(aliceAtIndex, aliceCustodian.address);

            const bobAtIndex = await bridgeInstance.custodianAddress(1);
            assert.equal(bobAtIndex, bobCustodian.address);

            const carlAtIndex = await bridgeInstance.custodianAddress(2);
            assert.equal(carlAtIndex, carlCustodian.address);
        });

        it("Should not set a custodian if not from admin", async () => {
            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(bridgeInstance.from(notAdmin.address).setCustodian(aliceCustodian.address, true), expectedRevertMessage);
        });

        it("Should not set same custodian twice", async () => {
            const expectedRevertMessage = "Custodians: Cannot add existing custodian";

            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await assert.revertWith(bridgeInstance.setCustodian(aliceCustodian.address, true), expectedRevertMessage);
        });

        it("Should emit CustodianSet event", async () => {
            const expectedEvent = "CustodianSet";
            await assert.emit(
                bridgeInstance.setCustodian(
                    aliceCustodian.address,
                    true
                ),
                expectedEvent
            );
        });

        it("Should remove a custodian", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await bridgeInstance.setCustodian(bobCustodian.address, true);
            let aliceStatus = await bridgeInstance.isCustodian(aliceCustodian.address);
            assert.ok(aliceStatus);
            let custodiansCount = await bridgeInstance.custodianCount();
            let expectedCount = 2;
            assert(custodiansCount.eq(expectedCount));

            await bridgeInstance.setCustodian(aliceCustodian.address, false);
            aliceStatus = await bridgeInstance.isCustodian(aliceCustodian.address);
            assert.ok(!aliceStatus);

            custodiansCount = await bridgeInstance.custodianCount();
            expectedCount = 1;
            assert(custodiansCount.eq(expectedCount));
        });

        it("Should not remove same custodian twice", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);

            await bridgeInstance.setCustodian(aliceCustodian.address, false);

            const expectedRevertMessage = "Custodians: Cannot remove non-existing custodian";
            await assert.revertWith(bridgeInstance.setCustodian(aliceCustodian.address, false), expectedRevertMessage);
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

        it("Should not set a service fee if not from owner", async () => {
            const newFee = 7000;

            const expectedRevertMessage = "Ownable: caller is not the owner";
            await assert.revertWith(bridgeInstance.from(aliceCustodian).setServiceFee(newFee), expectedRevertMessage);
        });

        it("Should revertWith if service fee is equal or above 100%", async () => {
            const newFee = precision;
            const expectedRevertMessage = "Bridge: Service fee cannot exceed 100%";
            await assert.revertWith(bridgeInstance.setServiceFee(newFee), expectedRevertMessage);
        });
    });


    describe("Mint", function () {

        beforeEach(async () => {

            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await bridgeInstance.setCustodian(bobCustodian.address, true);
            await bridgeInstance.setCustodian(carlCustodian.address, true);
        });

        it("Should execute mint transaction", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);
            const carlSignatude = await carlCustodian.signMessage(hashData);

            await bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignatude]);

            const expectedServiceFee = amount.sub(txCost).mul(serviceFee).div(precision);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            assert(balanceOFReciever.eq(amount.sub(txCost).sub(expectedServiceFee)));

            const aliceBalance = await bridgeInstance.feesAccrued(aliceCustodian.address);
            assert(aliceBalance.eq(expectedServiceFee.div(3).add(txCost)));

            const bobBalance = await bridgeInstance.feesAccrued(bobCustodian.address);
            assert(bobBalance.eq(expectedServiceFee.div(3)));

            const carlBalance = await bridgeInstance.feesAccrued(carlCustodian.address);
            assert(carlBalance.eq(expectedServiceFee.div(3)));

            const totalCustodiansAmount = await bridgeInstance.totalFeesAccrued();

            assert(totalCustodiansAmount.eq(expectedServiceFee.add(txCost)));

            const isExecuted = await bridgeInstance.mintTransfers(transactionId);
            assert.ok(isExecuted);
        });

        it("Should emit Mint event", async () => {
            const expectedEvent = "Mint";

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);
            const carlSignatude = await carlCustodian.signMessage(hashData);

            await assert.emit(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignatude]), expectedEvent);
        });

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);
            const carlSignature = await carlCustodian.signMessage(hashData);


            await bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]);

            const expectedRevertMessage = "Bridge: txId already submitted";
            await assert.revertWith(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);

            const expectedRevertMessage = "Bridge: Invalid confirmations";
            await assert.revertWith(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction from other than a custodian", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);

            const expectedRevertMessage = "Bridge: msg.sender is not a custodian";
            await assert.revertWith(bridgeInstance.mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction signed from non custodian", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const nonCustodianSignature = await nonCustodian.signMessage(hashData);

            const expectedRevertMessage = "Bridge: invalid signer";
            await assert.revertWith(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, nonCustodianSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);

            const expectedRevertMessage = "Bridge: signature already set";
            await assert.revertWith(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, aliceSignature]), expectedRevertMessage);
        });

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);

            const expectedRevertMessage = "Bridge: invalid signer";
            await assert.revertWith(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, wrongAmount, txCost, [aliceSignature, bobSignature]), expectedRevertMessage);
        });

    });

    describe("Burn", function () {

        beforeEach(async () => {

            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await bridgeInstance.setCustodian(bobCustodian.address, true);
            await bridgeInstance.setCustodian(carlCustodian.address, true);

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);
            const carlSignatude = await carlCustodian.signMessage(hashData);

            await bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignatude]);

        });

        it("Should burn tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonCustodian).approve(bridgeInstance.contractAddress, amountToBurn);

            const balanceOFReciever = await whbarInstance.balanceOf(receiver);
            const aliceBalance = await bridgeInstance.feesAccrued(aliceCustodian.address);
            const bobBalance = await bridgeInstance.feesAccrued(bobCustodian.address);
            const carlBalance = await bridgeInstance.feesAccrued(carlCustodian.address);
            const totalCustodiansAmount = await bridgeInstance.totalFeesAccrued();

            await bridgeInstance.from(nonCustodian).burn(amountToBurn, hederaAddress);

            const balanceOFRecieverAfter = await whbarInstance.balanceOf(receiver);
            const aliceBalanceAfter = await bridgeInstance.feesAccrued(aliceCustodian.address);
            const bobBalanceAfter = await bridgeInstance.feesAccrued(bobCustodian.address);
            const carlBalanceAfter = await bridgeInstance.feesAccrued(carlCustodian.address);
            const totalCustodiansAmountAfter = await bridgeInstance.totalFeesAccrued();

            const feeAmount = amountToBurn.mul(serviceFee).div(precision);

            assert(balanceOFRecieverAfter.eq(balanceOFReciever.sub(amountToBurn)));
            assert(aliceBalanceAfter.eq(aliceBalance.add(feeAmount.div(3))));
            assert(bobBalanceAfter.eq(bobBalance.add(feeAmount.div(3))));
            assert(carlBalanceAfter.eq(carlBalance.add(feeAmount.div(3))));
            assert(totalCustodiansAmountAfter.eq(totalCustodiansAmount.add(feeAmount)));

        });

        it("Should emit burn event", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonCustodian).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedEvent = "Burn";

            await assert.emit(bridgeInstance.from(nonCustodian).burn(amountToBurn, hederaAddress), expectedEvent);
        });

        it("Should revert if there are no approved tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");

            const expectedRevertMessage = "ERC20: burn amount exceeds allowance";
            await assert.revertWith(bridgeInstance.from(nonCustodian).burn(amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if invoker has no tokens", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(aliceCustodian).approve(bridgeInstance.contractAddress, amountToBurn);

            const expectedRevertMessage = "ERC20: burn amount exceeds balance";
            await assert.revertWith(bridgeInstance.from(aliceCustodian).burn(amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if deprecated", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonCustodian).approve(bridgeInstance.contractAddress, amountToBurn);

            await bridgeInstance.deprecate();

            const expectedRevertMessage = "Pausable: paused";
            await assert.revertWith(bridgeInstance.from(nonCustodian).burn(amountToBurn, hederaAddress), expectedRevertMessage);
        });

        it("Should revert if hederaAddress is invalid", async () => {
            const amountToBurn = ethers.utils.parseEther("5");
            await whbarInstance.from(nonCustodian).approve(bridgeInstance.contractAddress, amountToBurn);

            const invalidHederaAddress = [];

            const expectedRevertMessage = "Bridge: invalid receiverAddress value";
            await assert.revertWith(bridgeInstance.from(nonCustodian).burn(amountToBurn, invalidHederaAddress), expectedRevertMessage);
        });
    });

    describe("Withdraw and Deprecate bridge", function () {

        beforeEach(async () => {

            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await bridgeInstance.setCustodian(bobCustodian.address, true);
            await bridgeInstance.setCustodian(carlCustodian.address, true);

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);
            const carlSignatude = await carlCustodian.signMessage(hashData);

            await bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignatude]);
        });

        describe("Withdraw", function () {
            it("Should withdraw service fees", async () => {
                const totalAmount = await bridgeInstance.totalFeesAccrued();

                const tokensTotalSupply = await whbarInstance.totalSupply();
                const expextedTotalSupply = amount.sub(txCost).sub(amount.sub(txCost).mul(serviceFee).div(precision));
                assert(tokensTotalSupply.eq(expextedTotalSupply));

                // Alice
                await bridgeInstance.from(aliceCustodian.address).withdraw();

                const aliceBalance = await whbarInstance.balanceOf(aliceCustodian.address);

                const expectedAliceBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3).add(txCost);
                assert(aliceBalance.eq(expectedAliceBalance));

                let custodianAmountLeft = await bridgeInstance.feesAccrued(aliceCustodian.address);
                assert(custodianAmountLeft.eq(0));

                let totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(aliceBalance)));

                // Bob
                await bridgeInstance.from(bobCustodian.address).withdraw();
                const bobBalance = await whbarInstance.balanceOf(bobCustodian.address);

                const expectedBobBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(bobBalance.eq(expectedBobBalance));

                custodianAmountLeft = await bridgeInstance.feesAccrued(bobCustodian.address);
                assert(custodianAmountLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance)));

                // Carl
                await bridgeInstance.from(carlCustodian.address).withdraw();
                const carlBalance = await whbarInstance.balanceOf(carlCustodian.address);

                const expectedCarlBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(carlBalance.eq(expectedCarlBalance));

                custodianAmountLeft = await bridgeInstance.feesAccrued(carlCustodian.address);
                assert(custodianAmountLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance).sub(carlBalance)));

                const newTokensTotalSupply = await whbarInstance.totalSupply();
                assert(newTokensTotalSupply.eq(expextedTotalSupply.add(aliceBalance).add(bobBalance).add(carlBalance)));
            });

            it("Should emit Withdraw event", async () => {
                const expectedEvent = "Withdraw";
                await assert.emit(bridgeInstance.from(aliceCustodian.address).withdraw(), expectedEvent);
            });

            it("Should revertWith if user without balance tries to withdraw", async () => {
                const expectedRevertMessage = "Bridge: msg.sender has nothing to withdraw";
                await assert.revertWith(bridgeInstance.from(nonCustodian.address).withdraw(), expectedRevertMessage);
            });
        });

        describe("Deprecate", function () {
            it("Should depricate Bridge", async () => {
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

            it("Should not depricate Bridge if already deprecated", async () => {
                await bridgeInstance.deprecate();
                const expectedRevertMessage = "Pausable: paused";
                await assert.revertWith(bridgeInstance.deprecate(), expectedRevertMessage);
            });

            it("Should not depricate Bridge if not called from owner", async () => {
                const expectedRevertMessage = "Ownable: caller is not the owner";
                await assert.revertWith(bridgeInstance.from(aliceCustodian).deprecate(), expectedRevertMessage);
            });

            it("Should allow custodians to withdraw when depricated", async () => {
                await bridgeInstance.deprecate();

                const expextedTotalSupply = amount;
                let tokensTotalSupply = await whbarInstance.totalSupply();
                assert(tokensTotalSupply.eq(expextedTotalSupply));

                const totalAmount = await bridgeInstance.totalFeesAccrued();

                // Alice
                await bridgeInstance.from(aliceCustodian.address).withdraw();

                const aliceBalance = await whbarInstance.balanceOf(aliceCustodian.address);

                const expectedAliceBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3).add(txCost);
                assert(aliceBalance.eq(expectedAliceBalance));

                let custodianAmountLeft = await bridgeInstance.feesAccrued(aliceCustodian.address);
                assert(custodianAmountLeft.eq(0));

                let totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(aliceBalance)));

                // Bob
                await bridgeInstance.from(bobCustodian.address).withdraw();
                const bobBalance = await whbarInstance.balanceOf(bobCustodian.address);

                const expectedBobBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(bobBalance.eq(expectedBobBalance));

                custodianAmountLeft = await bridgeInstance.feesAccrued(bobCustodian.address);
                assert(custodianAmountLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance)));

                // Carl
                await bridgeInstance.from(carlCustodian.address).withdraw();
                const carlBalance = await whbarInstance.balanceOf(carlCustodian.address);

                const expectedCarlBalance = amount.sub(txCost).mul(serviceFee).div(precision).div(3);
                assert(carlBalance.eq(expectedCarlBalance));

                custodianAmountLeft = await bridgeInstance.feesAccrued(carlCustodian.address);
                assert(custodianAmountLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance).sub(carlBalance)));

                tokensTotalSupply = await whbarInstance.totalSupply();
                assert(tokensTotalSupply.eq(expextedTotalSupply));
            });

            it("Should not allow mint transaction if depricated", async () => {
                await bridgeInstance.deprecate();

                newTxId = "0x2";
                const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [newTxId, receiver, amount, txCost]);
                const hashMsg = ethers.utils.keccak256(encodeData);
                const hashData = ethers.utils.arrayify(hashMsg);

                const aliceSignature = await aliceCustodian.signMessage(hashData);
                const bobSignature = await bobCustodian.signMessage(hashData);
                const carlSignatude = await carlCustodian.signMessage(hashData);

                const expectedRevertMessage = "Pausable: paused";
                await assert.revertWith(bridgeInstance.from(aliceCustodian).mint(newTxId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignatude]), expectedRevertMessage);
            });
        });
    });
});
