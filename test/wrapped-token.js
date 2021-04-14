const { expect, assert } = require("chai");


describe("WrappedToken", function () {
    let WrappedToken, wrappedTokenInstance;

    const name = "WrapedHBAR";
    const symbol = "WrappedToken";
    const decimals = 8;


    beforeEach(async () => {
        [owner, alice, controller] = await ethers.getSigners();

        WrappedToken = await ethers.getContractFactory("WrappedToken");
        wrappedTokenInstance = await WrappedToken.deploy(name, symbol, decimals, controller.address);
        await wrappedTokenInstance.deployed();
    });

    it("Should deploy token contract", async () => {
        const _owner = await wrappedTokenInstance.owner();
        expect(_owner).to.eq(owner.address);

        const _decimals = await wrappedTokenInstance.decimals();

        expect(_decimals).to.eq(decimals);
    });

    it("Should pause the token", async () => {
        await wrappedTokenInstance.pause();
        const isPaused = await wrappedTokenInstance.paused();
        expect(isPaused).be.true;
    });

    it("Should revert if not owner tries to pause the token", async () => {
        const expectedRevertMessage = "Ownable: caller is not the owner";
        await expect(wrappedTokenInstance.connect(alice).pause()).to.be.revertedWith(expectedRevertMessage);
    });

    it("Should unpause the token", async () => {
        await wrappedTokenInstance.pause();

        await wrappedTokenInstance.unpause();
        const isPaused = await wrappedTokenInstance.paused();
        expect(isPaused).to.false;
    });

    it("Should revert if not owner tries to unpause the token", async () => {
        await wrappedTokenInstance.pause();

        const expectedRevertMessage = "Ownable: caller is not the owner";
        await expect(wrappedTokenInstance.connect(alice).unpause()).to.be.revertedWith(expectedRevertMessage);
    });

    it("Should set bridge contract address as controller", async () => {
        await wrappedTokenInstance.setController(
            controller.address
        );
        const controllerAddress = await wrappedTokenInstance.controller();
        expect(controllerAddress).to.eq(controller.address, "The bridge address was not set corectly");
    });

    it("Should emit ControllerSet event", async () => {
        const expectedEvent = "ControllerSet";
        const expectedEventArgs = controller.address;

        await expect(wrappedTokenInstance.setController(controller.address))
            .to.emit(wrappedTokenInstance, expectedEvent)
            .withArgs(expectedEventArgs);
    });

    it("Should revert if not owner tries to set bridge contract address", async () => {
        const expectedRevertMessage = "Ownable: caller is not the owner";

        await expect(wrappedTokenInstance.connect(alice).setController(controller.address)).to.be.revertedWith(expectedRevertMessage);
    });

    it("Should mint tokens from controller", async () => {
        await wrappedTokenInstance.setController(
            controller.address,
        );
        const mintAmount = ethers.utils.parseEther("153");
        await wrappedTokenInstance.connect(controller).mint(alice.address, mintAmount);

        const aliceBalance = await wrappedTokenInstance.balanceOf(alice.address);
        assert(aliceBalance.eq(mintAmount));
    });

    it("Should revert if not controller tries to mint", async () => {
        const expectedRevertMessage = "WrappedToken: Not called by the controller contract";
        await wrappedTokenInstance.setController(
            controller.address,
        );
        const mintAmount = ethers.utils.parseEther("153");
        await expect(wrappedTokenInstance.connect(alice).mint(alice.address, mintAmount)).to.be.revertedWith(expectedRevertMessage);
    });

    it("Should burn tokens from controller", async () => {
        await wrappedTokenInstance.setController(
            controller.address,
        );
        const mintAmount = ethers.utils.parseEther("153");
        await wrappedTokenInstance.connect(controller).mint(alice.address, mintAmount);


        const burnAmount = ethers.utils.parseEther("103");
        await wrappedTokenInstance.connect(alice).approve(controller.address, burnAmount);
        await wrappedTokenInstance.connect(controller).burnFrom(alice.address, burnAmount);

        const aliceBalance = await wrappedTokenInstance.balanceOf(alice.address);
        assert(aliceBalance.eq(mintAmount.sub(burnAmount)));
    });

    it("Should revert if not controller tries to burn", async () => {
        const expectedRevertMessage = "WrappedToken: Not called by the controller contract";

        await wrappedTokenInstance.setController(
            controller.address,
        );
        const mintAmount = ethers.utils.parseEther("153");
        await wrappedTokenInstance.connect(controller).mint(alice.address, mintAmount);


        const burnAmount = ethers.utils.parseEther("103");
        await wrappedTokenInstance.connect(alice).approve(controller.address, burnAmount);
        await expect(wrappedTokenInstance.connect(alice).burnFrom(alice.address, burnAmount)).to.be.revertedWith(expectedRevertMessage);
    });

    it("Should revert if there is no allowance", async () => {
        const expectedRevertMessage = "ERC20: burn amount exceeds allowance";

        await wrappedTokenInstance.setController(
            controller.address,
        );
        const mintAmount = ethers.utils.parseEther("153");
        await wrappedTokenInstance.connect(controller).mint(alice.address, mintAmount);


        const burnAmount = ethers.utils.parseEther("103");
        await expect(wrappedTokenInstance.connect(controller).burnFrom(alice.address, burnAmount)).to.be.revertedWith(expectedRevertMessage);
    });


    it("Should not mint if token is paused", async () => {
        await wrappedTokenInstance.setController(
            controller.address,
        );
        await wrappedTokenInstance.connect(owner).pause();

        const mintAmount = ethers.utils.parseEther("153");

        const expectedRevertMessage = "ERC20Pausable: token transfer while paused";
        await expect(wrappedTokenInstance.connect(controller).mint(alice.address, mintAmount)).to.be.revertedWith(expectedRevertMessage);
    });

    it("Should not burn if token is paused", async () => {
        await wrappedTokenInstance.setController(
            controller.address,
        );

        const mintAmount = ethers.utils.parseEther("153");
        await wrappedTokenInstance.connect(controller).mint(alice.address, mintAmount);

        await wrappedTokenInstance.connect(owner).pause();

        const expectedRevertMessage = "ERC20Pausable: token transfer while paused";

        const burnAmount = ethers.utils.parseEther("103");
        await wrappedTokenInstance.connect(alice).approve(controller.address, burnAmount);
        await expect(wrappedTokenInstance.connect(controller).burnFrom(alice.address, burnAmount)).to.be.revertedWith(expectedRevertMessage);
    });
});
