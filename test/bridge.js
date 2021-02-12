const etherlime = require("etherlime-lib");
const Bridge = require("../build/Bridge");
const WHBAR = require("../build/WHBAR");
const ethers = require("ethers");

describe("WHBAR", function () {
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

    // 10% multiplied by 1000
    const serviceFee = "5000";

    const transactionId = "0x1";
    const receiver = nonCustodian.address;
    const amount = ethers.utils.parseEther("100");
    const txCost = ethers.utils.parseEther("1");


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

        await whbarInstance.setBridgeContractAddress(bridgeInstance.contractAddress);
    });

    describe("Contract Setup", function () {

        it("should deploy Bridge contract", async () => {
            assert.isAddress(
                bridgeInstance.contractAddress,
                "The contract was not deployed"
            );
            const tokenAddress = await bridgeInstance.whbarToken();
            assert.equal(tokenAddress, whbarInstance.contractAddress);
            const _serviceFee = await bridgeInstance.serviceFee();
            assert(_serviceFee.eq(serviceFee));

        });

        it("should set a custodian", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            let aliceStatus = await bridgeInstance.isCustodian(aliceCustodian.address);
            assert.ok(aliceStatus);
            const custodianCount = await bridgeInstance.custodianCount();
            const expectedCount = 1;
            assert(custodianCount.eq(expectedCount));
        });

        it("should set multiple custodians", async () => {
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
        });

        it("should not set a custodian if not from admin", async () => {
            await assert.revert(bridgeInstance.from(notAdmin.address).setCustodian(aliceCustodian.address, true));
        });

        it("should not set same custodian twice", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await assert.revert(bridgeInstance.setCustodian(aliceCustodian.address, true));
        });

        it("should emit CustodianSet event", async () => {
            const expectedEvent = "CustodianSet";
            await assert.emit(
                bridgeInstance.setCustodian(
                    aliceCustodian.address,
                    true
                ),
                expectedEvent
            );
        });

        it("should remove a custodians", async () => {
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

        it("should not remove same custodian twice", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await bridgeInstance.setCustodian(bobCustodian.address, true);

            await bridgeInstance.setCustodian(aliceCustodian.address, false);
            await assert.revert(bridgeInstance.setCustodian(aliceCustodian.address, false));
        });

        it("should set a service fee", async () => {
            const newFee = 7000;
            await bridgeInstance.setServiceFee(newFee);
        });

        it("should not set a service fee if not from owner", async () => {
            const newFee = 7000;
            await assert.revert(bridgeInstance.from(aliceCustodian).setServiceFee(newFee));
        });

        it("should revert if service fee is equal or above 100%", async () => {
            const newFee = 100000;
            await assert.revert(bridgeInstance.setServiceFee(newFee));
        });
    });

    describe("Token Operations", function () {

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

            const expectedServiceFee = amount.mul(serviceFee).div(100000);

            const balanceOFReciever = await whbarInstance.balanceOf(nonCustodian.address);
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

        it("should emit Mint event", async () => {
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
            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignature]));
        });

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature]));
        });

        it("Should not execute mint transaction from other than a custodian", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature]));
        });

        it("Should not execute mint transaction signed from non custodian", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const nonCustodianSignature = await nonCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, nonCustodianSignature]));
        });

        it("Should not execute mint transaction with identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, aliceSignature]));
        });

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, wrongAmount, txCost, [aliceSignature, bobSignature]));
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
                const expextedTotalSupply = amount.sub(txCost).sub(amount.mul(serviceFee).div(100000));
                assert(tokensTotalSupply.eq(expextedTotalSupply));

                // Alice
                await bridgeInstance.from(aliceCustodian.address).withdraw();

                const aliceBalance = await whbarInstance.balanceOf(aliceCustodian.address);

                const expectedAliceBalance = amount.mul(serviceFee).div(100000).div(3).add(txCost);
                assert(aliceBalance.eq(expectedAliceBalance));

                let custodianAmountLeft = await bridgeInstance.feesAccrued(aliceCustodian.address);
                assert(custodianAmountLeft.eq(0));

                let totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(aliceBalance)));

                // Bob
                await bridgeInstance.from(bobCustodian.address).withdraw();
                const bobBalance = await whbarInstance.balanceOf(bobCustodian.address);

                const expectedBobBalance = amount.mul(serviceFee).div(100000).div(3);
                assert(bobBalance.eq(expectedBobBalance));

                custodianAmountLeft = await bridgeInstance.feesAccrued(bobCustodian.address);
                assert(custodianAmountLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance)));

                // Carl
                await bridgeInstance.from(carlCustodian.address).withdraw();
                const carlBalance = await whbarInstance.balanceOf(carlCustodian.address);

                const expectedCarlBalance = amount.mul(serviceFee).div(100000).div(3);
                assert(carlBalance.eq(expectedCarlBalance));

                custodianAmountLeft = await bridgeInstance.feesAccrued(carlCustodian.address);
                assert(custodianAmountLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance).sub(carlBalance)));

                const newTokensTotalSupply = await whbarInstance.totalSupply();
                const newExpextedTotalSupply = amount.sub(txCost).sub(amount.mul(serviceFee).div(100000));
                assert(newTokensTotalSupply.eq(newExpextedTotalSupply.add(aliceBalance).add(bobBalance).add(carlBalance)));
            });

            it("should emit Withdraw event", async () => {
                const expectedEvent = "Withdraw";
                await assert.emit(bridgeInstance.from(aliceCustodian.address).withdraw(), expectedEvent);
            });

            it("Should revert if user without balance tries to withdraw", async () => {
                await assert.revert(bridgeInstance.from(nonCustodian.address).withdraw());
            });
        });

        describe("Deprecate", function () {
            it("Should depricate Bridge", async () => {
                let isPaused = await bridgeInstance.paused();
                assert.ok(!isPaused);
                await bridgeInstance.deprecate();
                const balanceOfBridge = await whbarInstance.balanceOf(bridgeInstance.contractAddress);
                const expectedBalance = amount.mul(serviceFee).div(100000).add(txCost);
                assert(balanceOfBridge.eq(expectedBalance));

                isPaused = await bridgeInstance.paused();
                assert.ok(isPaused);
            });

            it("should emit Deprecate event", async () => {
                const expectedEvent = "Deprecate";
                await assert.emit(bridgeInstance.deprecate(), expectedEvent);
            });

            it("Should not depricate Bridge if already deprecated", async () => {
                await bridgeInstance.deprecate();
                await assert.revert(bridgeInstance.deprecate());
            });

            it("Should not depricate Bridge if not called from owner", async () => {
                await assert.revert(bridgeInstance.from(aliceCustodian).deprecate());
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

                const expectedAliceBalance = amount.mul(serviceFee).div(100000).div(3).add(txCost);
                assert(aliceBalance.eq(expectedAliceBalance));

                let custodianAmountLeft = await bridgeInstance.feesAccrued(aliceCustodian.address);
                assert(custodianAmountLeft.eq(0));

                let totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(aliceBalance)));

                // Bob
                await bridgeInstance.from(bobCustodian.address).withdraw();
                const bobBalance = await whbarInstance.balanceOf(bobCustodian.address);

                const expectedBobBalance = amount.mul(serviceFee).div(100000).div(3);
                assert(bobBalance.eq(expectedBobBalance));

                custodianAmountLeft = await bridgeInstance.feesAccrued(bobCustodian.address);
                assert(custodianAmountLeft.eq(0));

                totalAmountLeft = await bridgeInstance.totalFeesAccrued();
                assert(totalAmountLeft.eq(totalAmount.sub(bobBalance).sub(aliceBalance)));

                // Carl
                await bridgeInstance.from(carlCustodian.address).withdraw();
                const carlBalance = await whbarInstance.balanceOf(carlCustodian.address);

                const expectedCarlBalance = amount.mul(serviceFee).div(100000).div(3);
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

                await assert.revert(bridgeInstance.from(aliceCustodian).mint(newTxId, receiver, amount, txCost, [aliceSignature, bobSignature, carlSignatude]));
            });
        });
    });
});
