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
        });

        it("should set a custodian", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            const aliceStatus = await bridgeInstance.custodians(aliceCustodian.address);
            assert.ok(aliceStatus);
            const custodiansCount = await bridgeInstance.totalCustodians();
            const expectedCount = 1;
            assert.equal(custodiansCount.toString(), expectedCount)
        });

        it("should set multiple custodians", async () => {
            await bridgeInstance.setCustodian(aliceCustodian.address, true);
            await bridgeInstance.setCustodian(bobCustodian.address, true);
            await bridgeInstance.setCustodian(carlCustodian.address, true);
            const aliceStatus = await bridgeInstance.custodians(aliceCustodian.address);
            const bobStatus = await bridgeInstance.custodians(bobCustodian.address);
            const carlStatus = await bridgeInstance.custodians(carlCustodian.address);
            assert.ok(aliceStatus);
            assert.ok(bobStatus);
            assert.ok(carlStatus);
            const custodiansCount = await bridgeInstance.totalCustodians();
            const expectedCount = 3;
            assert.equal(custodiansCount.toString(), expectedCount)
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
            let aliceStatus = await bridgeInstance.custodians(aliceCustodian.address);
            assert.ok(aliceStatus);
            let custodiansCount = await bridgeInstance.totalCustodians();
            let expectedCount = 2;
            assert.equal(custodiansCount.toString(), expectedCount)

            await bridgeInstance.setCustodian(aliceCustodian.address, false);
            aliceStatus = await bridgeInstance.custodians(aliceCustodian.address);
            assert.ok(!aliceStatus);

            custodiansCount = await bridgeInstance.totalCustodians();
            expectedCount = 1;
            assert.equal(custodiansCount.toString(), expectedCount)
        });

        it("should set a service fee", async () => {
            const newFee = 7000;
            await bridgeInstance.setServiceFee(newFee);
        });

        it("should not set a service fee if not from owner", async () => {
            const newFee = 7000;
            await assert.revert(bridgeInstance.from(aliceCustodian).setServiceFee(newFee));
        });

        it("should revert if service fee is above 100%", async () => {
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

            const isExecuted = await bridgeInstance.mintTransfers(transactionId);

            assert.ok(isExecuted);
        })

        it("Should not execute same mint transaction twice", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);

            await bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature]);
            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature]));
        })

        it("Should not execute mint transaction with less than the half signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature]));
        })

        it("Should not execute mint transaction from other than a custodian", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.mint(transactionId, receiver, amount, txCost, [aliceSignature, bobSignature]));
        })

        it("Should not execute mint transaction signed from non custodian", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const nonCustodianSignature = await nonCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, nonCustodianSignature]));
        })

        it("Should not execute mint transaction with two identical signatures", async () => {
            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, amount, txCost, [aliceSignature, aliceSignature]));
        })

        it("Should not execute mint transaction with wrong data", async () => {
            const wrongAmount = ethers.utils.parseEther("200");

            const encodeData = ethers.utils.defaultAbiCoder.encode(["bytes", "address", "uint256", "uint256"], [transactionId, receiver, amount, txCost]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            const hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await aliceCustodian.signMessage(hashData);
            const bobSignature = await bobCustodian.signMessage(hashData);

            await assert.revert(bridgeInstance.from(aliceCustodian).mint(transactionId, receiver, wrongAmount, txCost, [aliceSignature, bobSignature]));
        })
    })
});
