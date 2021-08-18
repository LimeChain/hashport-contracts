const chai = require('chai');
const { ethers, waffle, network } = require('hardhat');
chai.use(waffle.solidity);
const expect = chai.expect;

const { createPermit, diamondAsFacet, getInterfaceId, getSelectors } = require('../util');

describe('Router', async () => {
  let nativeToken;
  let nativeTokenFactory;
  let wrappedTokenFactory;
  let diamond;
  let router;
  let routerFacet;
  let ownershipFacet;
  let governanceFacet;
  let feeCalculatorFacet;
  let cutFacet;
  let loupeFacet;
  let owner;
  let alice;
  let bob;
  let carol;
  let nonMember;

  const chainId = network.config.chainId;
  const GOVERNANCE_PRECISION = 100;
  const GOVERNANCE_PERCENTAGE = 50;

  const FEE_CALCULATOR_TOKEN_SERVICE_FEE = 10_000;
  const FEE_CALCULATOR_PRECISION = 100_000;

  const amount = ethers.utils.parseEther('100');
  const permitDeadline = Math.round(Date.now() / 1000) + 60 * 60;
  const transactionId = '0x000000000000000000000000000000000000000000000000000000000000000000000000';
  const wrappedTokenName = 'Wrapped Token';
  const wrappedTokenSymbol = 'WT';
  const wrappedTokenDecimals = 18;

  beforeEach(async () => {
    [owner, alice, bob, carol, nonMember] = await ethers.getSigners();

    nativeTokenFactory = await ethers.getContractFactory('Token');
    nativeToken = await nativeTokenFactory.deploy('NativeToken', 'NT', 18);
    await nativeToken.deployed();

    wrappedTokenFactory = await ethers.getContractFactory('WrappedToken');

    const routerFacetFactory = await ethers.getContractFactory('RouterFacet');
    routerFacet = await routerFacetFactory.deploy();
    await routerFacet.deployed();

    const ownershipFacetFactory = await ethers.getContractFactory('OwnershipFacet');
    ownershipFacet = await ownershipFacetFactory.deploy();
    await ownershipFacet.deployed();

    const feeCalculatorFacetFactory = await ethers.getContractFactory('FeeCalculatorFacet');
    feeCalculatorFacet = await feeCalculatorFacetFactory.deploy();
    await feeCalculatorFacet.deployed();

    const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
    governanceFacet = await governanceFacetFactory.deploy();
    await governanceFacet.deployed();

    const diamondCutFacetFactory = await ethers.getContractFactory('DiamondCutFacet');
    cutFacet = await diamondCutFacetFactory.deploy();
    await cutFacet.deployed();

    const diamondLoupeFacetFactory = await ethers.getContractFactory('DiamondLoupeFacet');
    loupeFacet = await diamondLoupeFacetFactory.deploy();
    await loupeFacet.deployed();

    const diamondCut = [
      [cutFacet.address, 0, getSelectors(cutFacet)],
      [loupeFacet.address, 0, getSelectors(loupeFacet)],
      [feeCalculatorFacet.address, 0, getSelectors(feeCalculatorFacet)],
      [governanceFacet.address, 0, getSelectors(governanceFacet)],
      [ownershipFacet.address, 0, getSelectors(ownershipFacet)],
      [routerFacet.address, 0, getSelectors(routerFacet)],
    ];

    const args = [
      owner.address
    ];

    const diamondFactory = await ethers.getContractFactory('Router');
    diamond = await diamondFactory.deploy(diamondCut, args);
    await diamond.deployed();

    router = await ethers.getContractAt('IRouterDiamond', diamond.address);

    await router.initGovernance([alice.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION);
    await router.initRouter();
    await router.initFeeCalculator(FEE_CALCULATOR_PRECISION);
  });

  describe('setup', async () => {
    it('should successfully deploy Router contract', async () => {
      expect(diamond.address).to.be.properAddress;
      expect(router.address).to.be.properAddress;
      expect(routerFacet.address).to.be.properAddress;
      expect(ownershipFacet.address).to.be.properAddress;
      expect(feeCalculatorFacet.address).to.be.properAddress;
      expect(cutFacet.address).to.be.properAddress;
      expect(loupeFacet.address).to.be.properAddress;

      // Fee Calculator
      expect(await router.serviceFeePrecision()).to.equal(FEE_CALCULATOR_PRECISION);

      // Governance
      expect(await router.membersCount()).to.equal(1);
      expect(await router.isMember(alice.address)).to.be.true;
      expect(await router.memberAt(0)).to.equal(alice.address);

      expect(await router.membersPrecision()).to.equal(GOVERNANCE_PRECISION);
      expect(await router.membersPercentage()).to.equal(GOVERNANCE_PERCENTAGE);

      // Ownership
      expect(await router.owner()).to.equal(owner.address);

      expect(await router.facetAddresses())
        .to.include(ownershipFacet.address)
        .to.include(routerFacet.address)
        .to.include(feeCalculatorFacet.address)
        .to.include(cutFacet.address)
        .to.include(loupeFacet.address);

      const facets = await router.facets();
      for (const facet of facets) {
        switch (facet.facetAddress) {
          case cutFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(cutFacet));
            break;
          case loupeFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(loupeFacet));
            break;
          case feeCalculatorFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(feeCalculatorFacet));
            break;
          case governanceFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(governanceFacet));
            break;
          case ownershipFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(ownershipFacet));
            break;
          case routerFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(routerFacet));
            break;
          default:
            throw 'invalid facet address'
        }
      }

      expect(await router.supportsInterface(getInterfaceId(ownershipFacet))).to.be.true;
    });

    it('should revert governance init if member list is empty', async () => {
      const expectedRevertMessage = 'GovernanceFacet: Member list must contain at least 1 element';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();

      await expect(testFacet.initGovernance([], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should not initialize RouterFacet twice', async () => {
      const expectedRevertMessage = 'RouterFacet: already initialized';
      await expect(router.initRouter()).to.be.revertedWith(expectedRevertMessage);
    });

    it('should not initialize GovernanceFacet twice', async () => {
      const expectedRevertMessage = 'GovernanceFacet: already initialized';
      await expect(router.initGovernance([alice.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if precision is 0', async () => {
      const expectedRevertMessage = 'GovernanceFacet: precision must not be zero';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address], GOVERNANCE_PERCENTAGE, 0)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if percentage is more than precision', async () => {
      const expectedRevertMessage = 'GovernanceFacet: percentage must be less or equal to precision';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address], GOVERNANCE_PRECISION + 1, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if percentage is equal to precision', async () => {
      const expectedRevertMessage = 'GovernanceFacet: percentage must be less or equal to precision';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address], GOVERNANCE_PRECISION, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init with duplicate addresses as members', async () => {
      const expectedRevertMessage = 'LibGovernance: Account already added';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address, alice.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should not initialize FeeCalculatorFacet twice', async () => {
      const expectedRevertMessage = 'FeeCalculatorFacet: already initialized';
      await expect(router.initFeeCalculator(FEE_CALCULATOR_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if precision is 0', async () => {
      const expectedRevertMessage = 'FeeCalculatorFacet: precision must not be zero';
      const feeCalculatorFacetFactory = await ethers.getContractFactory('FeeCalculatorFacet');
      const testFacet = await feeCalculatorFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initFeeCalculator(0)).to.be.revertedWith(expectedRevertMessage);
    });
  });

  describe('GovernanceFacet', async () => {
    describe('updateMembersPercentage', async () => {
      it('should update members percentage', async () => {
        const newMembersPercentage = GOVERNANCE_PERCENTAGE + 1;
        const oldMembersPercentage = await router.membersPercentage();

        expect(oldMembersPercentage).to.equal(GOVERNANCE_PERCENTAGE);

        await router.updateMembersPercentage(newMembersPercentage);

        expect(await router.membersPercentage()).to.equal(newMembersPercentage);
      });

      it('should emit event with args', async () => {
        const newMembersPercentage = GOVERNANCE_PERCENTAGE + 1;
        await expect(await router.updateMembersPercentage(newMembersPercentage))
          .to.emit(router, 'MembersPercentageUpdated')
          .withArgs(newMembersPercentage);
      });

      it('should revert when trying to set percentage equal to precision', async () => {
        const expectedRevertMessage = 'LibGovernance: percentage must be less than precision';

        await expect(router.updateMembersPercentage(GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when trying to set percentage more than to precision', async () => {
        const expectedRevertMessage = 'LibGovernance: percentage must be less than precision';

        await expect(router.updateMembersPercentage(GOVERNANCE_PRECISION + 1)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when trying to execute transaction with not owner', async () => {
        const expectedRevertMessage = 'LibDiamond: Must be contract owner';
        await expect(router.connect(nonMember).updateMembersPercentage(GOVERNANCE_PERCENTAGE)).to.be.revertedWith(expectedRevertMessage);
      });
    });

    describe('updateMember', async () => {
      it('should add a member', async () => {
        await router.updateMember(bob.address, true);

        const bobStatus = await router.isMember(bob.address);
        expect(bobStatus).to.be.true;

        const addressAtIndex = await router.memberAt(1);
        expect(addressAtIndex).to.equal(bob.address);

        const expectedCount = 2;
        expect(await router.membersCount()).to.equal(expectedCount);
      });

      it('should emit add event', async () => {
        await expect(await router.updateMember(bob.address, true))
          .to.emit(router, 'MemberUpdated')
          .withArgs(bob.address, true);
      });

      it('should revert setting a member twice', async () => {
        const expectedRevertMessage = 'LibGovernance: Account already added';
        await expect(router.updateMember(alice.address, true)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when trying to remove the last member', async () => {
        const expectedRevertMessage = 'LibGovernance: contract would become memberless';
        await expect(router.updateMember(alice.address, false)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should remove a member', async () => {
        await router.updateMember(bob.address, true);
        expect(await router.membersCount()).to.equal(2);

        await router.updateMember(alice.address, false);

        const aliceMember = await router.isMember(alice.address);

        expect(aliceMember).to.be.false;
        expect(await router.membersCount()).to.equal(1);
      });

      it('should emit remove event', async () => {
        await router.updateMember(bob.address, true);
        await expect(await router.updateMember(alice.address, false))
          .to.emit(router, 'MemberUpdated')
          .withArgs(alice.address, false);
      });

      it('should revert removing a member twice', async () => {
        await router.updateMember(bob.address, true);
        await router.updateMember(carol.address, true);

        await router.updateMember(alice.address, false);
        const expectedRevertMessage = 'LibGovernance: Account is not a member';
        await expect(router.updateMember(alice.address, false)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when executing transaction with not owner', async () => {
        const expectedRevertMessage = 'LibDiamond: Must be contract owner';
        await expect(router.connect(nonMember).updateMember(alice.address, false)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should correctly accrue fees after addition of a new member', async () => {
        // given
        const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
        await nativeToken.mint(nonMember.address, amount);

        await nativeToken.connect(nonMember).approve(router.address, amount);
        await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address);

        const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
        expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
        expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

        // when
        await router.updateMember(bob.address, true);

        // then
        const afterMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(afterMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
        expect(afterMemberUpdateTokenFeeData.accumulator).to.equal(serviceFee);
        expect(afterMemberUpdateTokenFeeData.previousAccrued).to.equal(afterMemberUpdateTokenFeeData.feesAccrued);

        expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(0);
        expect(await router.claimedRewardsPerAccount(bob.address, nativeToken.address)).to.equal(serviceFee);
      });

      it('should correctly accrue fees after removal of a member', async () => {
        // given
        const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
        const rewardPerMember = serviceFee.div(2);

        await router.updateMember(bob.address, true);
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
        await nativeToken.mint(nonMember.address, amount);

        await nativeToken.connect(nonMember).approve(router.address, amount);
        await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address);

        const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
        expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
        expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

        // when
        await expect(
          router.updateMember(alice.address, false))
          .to.emit(router, 'MemberUpdated')
          .withArgs(alice.address, false)
          .to.emit(nativeToken, 'Transfer')
          .withArgs(router.address, alice.address, rewardPerMember);

        const afterMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(afterMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
        expect(afterMemberUpdateTokenFeeData.accumulator).to.equal(rewardPerMember);
        expect(afterMemberUpdateTokenFeeData.previousAccrued).to.equal(afterMemberUpdateTokenFeeData.feesAccrued);

        expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(rewardPerMember);
      });
    });
  });

  describe('FeeCalculatorFacet', async () => {
    describe('setServiceFee', async () => {
      it('should successfully set service fee to a token', async () => {
        await router.setServiceFee(bob.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE);

        const tokenFeeData = await router.tokenFeeData(bob.address);
        expect(tokenFeeData.serviceFeePercentage).to.equal(FEE_CALCULATOR_TOKEN_SERVICE_FEE);
      });

      it('should emit event with args', async () => {
        await expect(router.setServiceFee(bob.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE))
          .to.emit(router, 'ServiceFeeSet')
          .withArgs(owner.address, bob.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE);
      });

      it('should revert when trying to set fee percentage equal to precision', async () => {
        const expectedRevertMessage = 'LibFeeCalculator: service fee percentage exceeds or equal to precision';
        await expect(router.setServiceFee(bob.address, FEE_CALCULATOR_PRECISION)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when trying to set fee percentage more than precision', async () => {
        const expectedRevertMessage = 'LibFeeCalculator: service fee percentage exceeds or equal to precision';
        await expect(router.setServiceFee(bob.address, FEE_CALCULATOR_PRECISION + 1)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when executing transaction with not owner', async () => {
        const expectedRevertMessage = 'LibDiamond: Must be contract owner';
        await expect(router.connect(nonMember).setServiceFee(bob.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE)).to.be.revertedWith(expectedRevertMessage);
      });
    });
  });

  describe('OwnershipFacet', async () => {
    it('should transfer ownership successfully', async () => {
      const expectedRevertMessage = 'LibDiamond: Must be contract owner';
      await router.transferOwnership(nonMember.address);

      expect(await router.owner()).to.equal(nonMember.address);

      const diamondCut = [
        { facetAddress: ethers.constants.AddressZero, action: 2, functionSelectors: getSelectors(router) }
      ];

      await expect(router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x'))
        .to.be.revertedWith(expectedRevertMessage);
    });

    it('should emit event', async () => {
      await expect(router.transferOwnership(nonMember.address))
        .to.emit(router, 'OwnershipTransferred')
        .withArgs(owner.address, nonMember.address);
    });
  });

  describe('RouterFacet', async () => {
    describe('updateNativeToken', async () => {
      it('should successfully add native token', async () => {
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);

        expect(await router.nativeTokensCount()).to.equal(1);
        expect(await router.nativeTokenAt(0)).to.equal(nativeToken.address);
      });

      it('should successfully emit event with args upon addition', async () => {
        await expect(
          router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true))
          .to.emit(router, 'NativeTokenUpdated')
          .withArgs(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      });

      it('should successfully remove native token', async () => {
        // given
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
        const beforeRemovalCount = await router.nativeTokensCount();

        // when
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, false);

        // then
        const afterRemovalCount = await router.nativeTokensCount();
        expect(afterRemovalCount).to.equal(beforeRemovalCount - 1);
      });

      it('should successfully emit event with args upon removal', async () => {
        // given
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
        // then
        await expect(
          router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, false))
          .to.emit(router, 'NativeTokenUpdated')
          .withArgs(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, false);
      });

      it('should revert with invalid zero address native token', async () => {
        const expectedRevertMessage = 'RouterFacet: zero address';
        await expect(
          router.updateNativeToken(ethers.constants.AddressZero, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when token is already added', async () => {
        // given
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
        // then
        const expectedRevertMessage = 'LibRouter: native token already added';
        await expect(
          router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when token is already removed', async () => {
        const expectedRevertMessage = 'LibRouter: native token not found';
        await expect(
          router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, false))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when token service fee is equal to precision', async () => {
        const expectedRevertMessage = 'LibFeeCalculator: service fee percentage exceeds or equal to precision';
        await expect(
          router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_PRECISION, true))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when token service fee is more than precision', async () => {
        const expectedRevertMessage = 'LibFeeCalculator: service fee percentage exceeds or equal to precision';
        await expect(
          router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_PRECISION + 1, true))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when executing transaction with not owner', async () => {
        const expectedRevertMessage = 'LibDiamond: Must be contract owner';
        await expect(
          router.connect(nonMember).updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true))
          .to.be.revertedWith(expectedRevertMessage);
      });

    });

    describe('deployWrappedToken', async () => {
      let expectedContractAddress;

      beforeEach(async () => {
        expectedContractAddress = ethers.utils.getContractAddress(
          {
            from: router.address,
            nonce: await owner.provider.getTransactionCount(router.address)
          });
      });

      it('should successfully deploy wrapped token', async () => {
        await router.deployWrappedToken(1, nativeToken.address,
          { name: wrappedTokenName, symbol: wrappedTokenSymbol, decimals: wrappedTokenDecimals });

        const wrappedToken = wrappedTokenFactory.attach(expectedContractAddress);

        expect(await wrappedToken.decimals()).to.equal(wrappedTokenDecimals);
        expect(await wrappedToken.symbol()).to.equal(wrappedTokenSymbol);
        expect(await wrappedToken.name()).to.equal(wrappedTokenName);
        expect(await wrappedToken.totalSupply()).to.equal(0);

        expect(await wrappedToken.owner()).to.equal(router.address);
      });

      it('should emit event with args', async () => {
        await expect(
          router.deployWrappedToken(1, nativeToken.address,
            { name: wrappedTokenName, symbol: wrappedTokenSymbol, decimals: wrappedTokenDecimals }))
          .to.emit(router, 'WrappedTokenDeployed')
          .withArgs(1, nativeToken.address.toLowerCase(), expectedContractAddress);
      });

      it('should revert when params name is empty', async () => {
        const expectedRevertMessage = 'RouterFacet: empty wrapped token name';
        await expect(
          router.deployWrappedToken(1, nativeToken.address,
            { name: '', symbol: wrappedTokenSymbol, decimals: wrappedTokenDecimals }))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when params symbol is empty', async () => {
        const expectedRevertMessage = 'RouterFacet: empty wrapped token symbol';
        await expect(
          router.deployWrappedToken(1, nativeToken.address,
            { name: wrappedTokenName, symbol: '', decimals: wrappedTokenDecimals }))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when params decimals is zero', async () => {
        const expectedRevertMessage = 'RouterFacet: invalid wrapped token decimals';
        await expect(
          router.deployWrappedToken(1, nativeToken.address,
            { name: wrappedTokenName, symbol: wrappedTokenSymbol, decimals: 0 }))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when transaction execution is not owner', async () => {
        const expectedRevertMessage = 'LibDiamond: Must be contract owner';
        await expect(
          router.connect(nonMember).deployWrappedToken(1, nativeToken.address,
            { name: wrappedTokenName, symbol: wrappedTokenSymbol, decimals: wrappedTokenDecimals }))
          .to.be.revertedWith(expectedRevertMessage);
      });
    });

    describe('lock', async () => {
      let receiver;

      beforeEach(async () => {
        await nativeToken.mint(nonMember.address, amount);
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);

        receiver = owner.address;
      });

      it('should execute lock', async () => {
        await nativeToken.connect(nonMember).approve(router.address, amount);

        await router.connect(nonMember).lock(1, nativeToken.address, amount, receiver);

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION));

        const routerBalance = await nativeToken.balanceOf(router.address);
        expect(routerBalance).to.equal(amount);
      });

      it('should emit event with args', async () => {
        await nativeToken.connect(nonMember).approve(router.address, amount);
        const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

        await expect(await router
          .connect(nonMember)
          .lock(1, nativeToken.address, amount, receiver))
          .to.emit(router, 'Lock')
          .withArgs(1, nativeToken.address, receiver.toLowerCase(), amount, serviceFee);
      });

      it('should revert if not enough tokens are approved', async () => {
        const expectedRevertMessage = 'ERC20: transfer amount exceeds allowance';
        await expect(
          router.connect(nonMember).lock(1, nativeToken.address, amount, receiver))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should lock with permit', async () => {
        const permit = await createPermit(nonMember, router.address, amount, permitDeadline, nativeToken);
        await router.connect(nonMember).lockWithPermit(1, nativeToken.address, amount, receiver, permitDeadline, permit.v, permit.r, permit.s);

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION));

        const routerBalance = await nativeToken.balanceOf(router.address);
        expect(routerBalance).to.equal(amount);

        expect(await nativeToken.nonces(nonMember.address)).to.equal(1);
      });

      it('should revert when native token is not found', async () => {
        const expectedRevertMessage = 'RouterFacet: native token not found';
        const notAddedNativeToken = await (await ethers.getContractFactory('Token')).deploy('NativeToken', 'NT', 18);
        const permit = await createPermit(nonMember, router.address, amount, permitDeadline, notAddedNativeToken);
        await expect(
          router
            .connect(nonMember)
            .lockWithPermit(1, notAddedNativeToken.address, amount, receiver, permitDeadline, permit.v, permit.r, permit.s))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should lock properly with zero service fee', async () => {
        await nativeToken.connect(nonMember).approve(router.address, amount);
        await router.setServiceFee(nativeToken.address, 0);

        await expect(await router
          .connect(nonMember)
          .lock(1, nativeToken.address, amount, receiver))
          .to.emit(router, 'Lock')
          .withArgs(1, nativeToken.address, receiver.toLowerCase(), amount, 0);

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(0);
      });
    });

    describe('unlock', async () => {
      let receiver;
      let hashData;

      let aliceSignature;
      let bobSignature;
      let carolSignature;

      let expectedFee;

      beforeEach(async () => {
        await nativeToken.mint(router.address, amount);
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);

        await router.updateMember(bob.address, true);
        await router.updateMember(carol.address, true);

        receiver = owner.address;

        const encodeData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes', 'address', 'uint256', 'bytes'], [1, chainId, transactionId, receiver, amount, nativeToken.address]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        hashData = ethers.utils.arrayify(hashMsg);

        aliceSignature = await alice.signMessage(hashData);
        bobSignature = await bob.signMessage(hashData);
        carolSignature = await carol.signMessage(hashData);

        expectedFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
      });

      it('should execute unlock', async () => {
        await router
          .connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature, bobSignature, carolSignature]);

        const balanceOfReceiver = await nativeToken.balanceOf(receiver);
        expect(balanceOfReceiver).to.equal(amount.sub(expectedFee));

        expect(await router.hashesUsed(ethers.utils.hashMessage(hashData))).to.be.true;

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(expectedFee);
      });

      it('should emit event with args', async () => {
        const transferAmount = amount.sub(expectedFee);
        const sourceChainId = 1;

        await expect(await router
          .connect(nonMember)
          .unlock(sourceChainId, transactionId, nativeToken.address, amount, receiver, [aliceSignature, bobSignature, carolSignature]))
          .to.emit(router, 'Unlock')
          .withArgs(sourceChainId, transactionId, nativeToken.address, transferAmount, receiver, expectedFee);
      });

      it('should revert when trying to execute same unlock transaction twice', async () => {
        const expectedRevertMessage = 'RouterFacet: transaction already submitted';
        await router
          .connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature, bobSignature, carolSignature]);

        await expect(router
          .connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature, bobSignature, carolSignature]))
          .to.be.revertedWith(expectedRevertMessage);

      });

      it('should revert when provided signatures are not enough', async () => {
        const expectedRevertMessage = 'LibGovernance: Invalid number of signatures';

        await expect(router.connect(nonMember).unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided signatures contains signed from non-member', async () => {
        const expectedRevertMessage = 'LibGovernance: invalid signer';
        const nonMemberSignature = await nonMember.signMessage(hashData);

        await expect(router.connect(nonMember).unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature, nonMemberSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided signatures are duplicate', async () => {
        const expectedRevertMessage = 'LibGovernance: duplicate signatures';

        await expect(router.connect(nonMember).unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature, aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided data is invalid', async () => {
        const expectedRevertMessage = 'Governance: invalid signer';
        await expect(router.connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, 1, receiver, [aliceSignature, bobSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when native token is not found', async () => {
        const expectedRevertMessage = 'RouterFacet: native token not found';
        await expect(router.connect(nonMember)
          .unlock(1, transactionId, bob.address, 1, receiver, [aliceSignature, bobSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });
    });

    describe('mint', async () => {
      let receiver;
      let hashData;
      let aliceSignature;
      let bobSignature;
      let carolSignature;
      let wrappedToken;

      beforeEach(async () => {
        await router.updateMember(bob.address, true);
        await router.updateMember(carol.address, true);

        receiver = owner.address;
        const wrappedTokenTx = await router.deployWrappedToken(1, nativeToken.address, { name: wrappedTokenName, symbol: wrappedTokenSymbol, decimals: wrappedTokenDecimals });
        const wrappedTokenTxReceipt = await wrappedTokenTx.wait();
        wrappedToken = wrappedTokenFactory.attach(wrappedTokenTxReceipt.events[1].args.wrappedToken);

        const encodeData = ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256', 'bytes', 'address', 'address', 'uint256'],
          [1, chainId, transactionId, wrappedToken.address, receiver, amount]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        hashData = ethers.utils.arrayify(hashMsg);

        aliceSignature = await alice.signMessage(hashData);
        bobSignature = await bob.signMessage(hashData);
        carolSignature = await carol.signMessage(hashData);
      });

      it('should mint successfully', async () => {
        await router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature, bobSignature, carolSignature]);

        const receiverBalance = await wrappedToken.balanceOf(receiver);
        expect(receiverBalance).to.equal(amount);

        expect(await router.hashesUsed(ethers.utils.hashMessage(hashData))).to.be.true;
      });

      it('should emit event with args', async () => {
        const sourceChainId = 1;
        await expect(await router.connect(nonMember).mint(
          sourceChainId,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature, bobSignature, carolSignature]))
          .to.emit(router, 'Mint')
          .withArgs(sourceChainId, transactionId, wrappedToken.address, amount, receiver)
          .to.emit(wrappedToken, 'Transfer')
          .withArgs(ethers.constants.AddressZero, receiver, amount);
      });

      it('should revert when trying to mint for the same transaction', async () => {
        const expectedRevertMessage = 'RouterFacet: transaction already submitted';
        await router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature, bobSignature, carolSignature]);

        await expect(router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature, bobSignature, carolSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert with insufficient signatures', async () => {
        const expectedRevertMessage = 'LibGovernance: Invalid number of signatures';
        await expect(router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert with a non-member signature', async () => {
        const expectedRevertMessage = 'LibGovernance: invalid signer';
        const nonMemberSignature = await nonMember.signMessage(hashData);

        await expect(router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature, nonMemberSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert with duplicate signatures', async () => {
        const expectedRevertMessage = 'LibGovernance: duplicate signatures';
        await expect(router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature, aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert with mismatching data and signatures', async () => {
        const expectedRevertMessage = 'LibGovernance: invalid signer';
        await expect(router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          1,
          [aliceSignature, aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      describe('pausability/ownership', async () => {
        beforeEach(async () => {
          wrappedToken = await wrappedTokenFactory.deploy(wrappedTokenName, wrappedTokenSymbol, wrappedTokenDecimals);
          await wrappedToken.deployed();

          const encodeData = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes', 'address', 'address', 'uint256'],
            [1, chainId, transactionId, wrappedToken.address, receiver, amount]);
          const hashMsg = ethers.utils.keccak256(encodeData);
          hashData = ethers.utils.arrayify(hashMsg);

          aliceSignature = await alice.signMessage(hashData);
          bobSignature = await bob.signMessage(hashData);
          carolSignature = await carol.signMessage(hashData);
        });

        it('should revert when router cannot mint', async () => {
          const expectedRevertMessage = 'Ownable: caller is not the owner';

          await expect(router.connect(nonMember).mint(
            1,
            transactionId,
            wrappedToken.address,
            receiver,
            amount,
            [aliceSignature, bobSignature, carolSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when trying to mint on a paused contract', async () => {
          const expectedRevertMessage = 'WrappedToken: token transfer while paused';

          await wrappedToken.pause();
          await wrappedToken.transferOwnership(router.address);

          await expect(router.connect(nonMember).mint(
            1,
            transactionId,
            wrappedToken.address,
            receiver,
            amount,
            [aliceSignature, bobSignature, carolSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });
      })
    });

    describe('burn', async () => {
      beforeEach(async () => {
        wrappedToken = await wrappedTokenFactory.deploy(wrappedTokenName, wrappedTokenSymbol, wrappedTokenDecimals);
        await wrappedToken.deployed();

        await wrappedToken.mint(nonMember.address, amount);

        receiver = owner.address;
      });

      it('should burn successfully', async () => {
        await wrappedToken.transferOwnership(router.address);
        await wrappedToken.connect(nonMember).approve(router.address, amount);

        await router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver);

        const balance = await wrappedToken.balanceOf(nonMember.address);
        expect(balance).to.equal(0);
      });

      it('should emit event with args', async () => {
        await wrappedToken.transferOwnership(router.address);
        await wrappedToken.connect(nonMember).approve(router.address, amount);

        await expect(await router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver))
          .to.emit(router, 'Burn')
          .withArgs(1, wrappedToken.address, amount, receiver.toLowerCase())
          .to.emit(wrappedToken, 'Transfer')
          .withArgs(nonMember.address, ethers.constants.AddressZero, amount);
      });

      it('should burn with permit', async () => {
        await wrappedToken.transferOwnership(router.address);
        const permit = await createPermit(nonMember, router.address, amount, permitDeadline, wrappedToken);

        await router.connect(nonMember).burnWithPermit(1, wrappedToken.address, amount, receiver, permitDeadline, permit.v, permit.r, permit.s);

        const balance = await wrappedToken.balanceOf(nonMember.address);
        expect(balance).to.equal(0);
      });

      it('should revert with no approved tokens', async () => {
        await wrappedToken.transferOwnership(router.address);
        await expect(router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver)).to.be.reverted;
      });

      it('should revert when router cannot burn', async () => {
        const expectedRevertMessage = 'Ownable: caller is not the owner';
        await expect(router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when wrapped token is paused', async () => {
        await wrappedToken.pause();
        await wrappedToken.transferOwnership(router.address);
        await wrappedToken.connect(nonMember).approve(router.address, amount);

        const expectedRevertMessage = 'WrappedToken: token transfer while paused';
        await expect(router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver))
          .to.be.revertedWith(expectedRevertMessage);
      });
    });
  });

  describe('Claim fees', async () => {
    let serviceFee;
    beforeEach(async () => {
      await nativeToken.mint(nonMember.address, amount);
      await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.updateMember(bob.address, true);
      await router.updateMember(carol.address, true);

      await nativeToken.connect(nonMember).approve(router.address, amount);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address);

      serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
    });

    it('should claim service fees for native token', async () => {
      await router.connect(alice).claim(nativeToken.address);
      await router.connect(bob).claim(nativeToken.address);
      await router.connect(carol).claim(nativeToken.address);

      const aliceBalance = await nativeToken.balanceOf(alice.address);
      const bobBalance = await nativeToken.balanceOf(bob.address);
      const carolBalance = await nativeToken.balanceOf(carol.address);

      const aliceClaimedRewards = await router.claimedRewardsPerAccount(alice.address, nativeToken.address);
      const bobClaimedRewards = await router.claimedRewardsPerAccount(bob.address, nativeToken.address);
      const carolClaimedRewards = await router.claimedRewardsPerAccount(carol.address, nativeToken.address);

      expect(aliceBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(aliceClaimedRewards);
      expect(bobBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(bobClaimedRewards);
      expect(carolBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(carolClaimedRewards);

      const tokenFeeData = await router.tokenFeeData(nativeToken.address);

      expect(tokenFeeData.feesAccrued).to.equal(tokenFeeData.previousAccrued);
      expect(tokenFeeData.accumulator).to.equal(serviceFee.div(3));
    });

    it('should claim multiple fees per members', async () => {
      // given
      await nativeToken.mint(nonMember.address, amount);
      await nativeToken.connect(nonMember).approve(router.address, amount);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address);

      serviceFee = serviceFee.mul(2);

      // when
      await router.connect(alice).claim(nativeToken.address);
      await router.connect(bob).claim(nativeToken.address);
      await router.connect(carol).claim(nativeToken.address);

      // then
      const aliceBalance = await nativeToken.balanceOf(alice.address);
      const bobBalance = await nativeToken.balanceOf(bob.address);
      const carolBalance = await nativeToken.balanceOf(carol.address);

      const aliceClaimedRewards = await router.claimedRewardsPerAccount(alice.address, nativeToken.address);
      const bobClaimedRewards = await router.claimedRewardsPerAccount(bob.address, nativeToken.address);
      const carolClaimedRewards = await router.claimedRewardsPerAccount(carol.address, nativeToken.address);

      expect(aliceBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(aliceClaimedRewards);
      expect(bobBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(bobClaimedRewards);
      expect(carolBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(carolClaimedRewards);

      const tokenFeeData = await router.tokenFeeData(nativeToken.address);

      expect(tokenFeeData.feesAccrued).to.equal(tokenFeeData.previousAccrued);
      expect(tokenFeeData.accumulator).to.equal(serviceFee.div(3));
    });

    it('should emit event with args', async () => {
      const claimAmount = serviceFee.div(3);
      await expect(router.connect(alice).claim(nativeToken.address))
        .to.emit(router, 'Claim')
        .withArgs(alice.address, nativeToken.address, claimAmount)
        .to.emit(nativeToken, 'Transfer')
        .withArgs(router.address, alice.address, claimAmount);
    });

    it('should revert when claimer is not a member', async () => {
      const expectedRevertMessage = 'FeeCalculatorFacet: msg.sender is not a member';
      await expect(router.connect(nonMember).claim(nativeToken.address)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should have been claimed after member removal', async () => {
      const claimAmount = serviceFee.div(3);
      await expect(router.updateMember(alice.address, false))
        .to.emit(nativeToken, 'Transfer')
        .withArgs(router.address, alice.address, claimAmount);

      const aliceBalance = await nativeToken.balanceOf(alice.address);
      const aliceClaimedRewards = await router.claimedRewardsPerAccount(alice.address, nativeToken.address);
      expect(aliceBalance)
        .to.equal(claimAmount)
        .to.equal(aliceClaimedRewards);

      const tokenFeeData = await router.tokenFeeData(nativeToken.address);

      expect(tokenFeeData.feesAccrued).to.equal(tokenFeeData.previousAccrued);
      expect(tokenFeeData.accumulator).to.equal(serviceFee.div(3));
    });
  });

  describe('Diamond', async () => {
    beforeEach(async () => {
      await router.updateMember(bob.address, true);
      await router.updateMember(carol.address, true);
    });

    it('should add new functions', async () => {
      const testFacetFactory = await ethers.getContractFactory('AddNewFunctionFacet');
      const testFacet = await testFacetFactory.deploy();
      await testFacet.deployed();

      const diamondCut = [
        { facetAddress: testFacet.address, action: 0, functionSelectors: getSelectors(testFacet) }
      ];

      await expect(router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x')).to.not.be.reverted;
      const test = await diamondAsFacet(diamond, 'AddNewFunctionFacet');
      await expect(test.testFunction()).to.not.be.reverted;
    });

    it('should remove all functions', async () => {
      const expectedRevertMessage = 'Diamond: Function does not exist';

      const diamondCut = [
        { facetAddress: ethers.constants.AddressZero, action: 2, functionSelectors: getSelectors(router) }
      ];

      await expect(router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x')).to.not.be.reverted;
      await expect(router.owner()).to.be.revertedWith(expectedRevertMessage);
      await expect(router.transferOwnership(nonMember.address)).to.be.revertedWith(expectedRevertMessage);
      await expect(router.facets()).to.be.revertedWith(expectedRevertMessage);
    });

    it('should remove all functions from the target facet', async () => {
      const expectedRevertMessage = 'Diamond: Function does not exist';
      const functionSelectors = getSelectors(ownershipFacet);

      const diamondCut = [
        { facetAddress: ethers.constants.AddressZero, action: 2, functionSelectors }
      ];

      // when
      await router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x');
      // then
      await expect(router.owner()).to.be.revertedWith(expectedRevertMessage);
      await expect(router.transferOwnership(nonMember.address)).to.be.revertedWith(expectedRevertMessage);
      await expect(router.facetFunctionSelectors(ownershipFacet.address)).to.be.empty;
      // and
      for (let i of functionSelectors) {
        expect(await router.facetAddress(i)).to.equal(ethers.constants.AddressZero);
      }
      // and
      expect(await router.facetAddresses()).to.not.include(ownershipFacet.address);
    });

    it('should replace functions', async () => {
      const expectedEvent = 'Replacement';
      const expectedEventSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('Replacement()'));

      const replaceFacetFactory = await ethers.getContractFactory('ReplaceFacet');
      const replaceFacet = await replaceFacetFactory.deploy();
      await replaceFacet.deployed();

      const diamondCut = [
        { facetAddress: replaceFacet.address, action: 1, functionSelectors: getSelectors(replaceFacet) }
      ];

      await expect(router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x')).to.not.be.reverted;
      const replace = await diamondAsFacet(diamond, 'ReplaceFacet');
      await expect(replace.owner()).to.emit(replace, expectedEvent);

      const result = await (await owner.sendTransaction(await router.populateTransaction.owner())).wait();
      expect(result.logs[0].topics[0]).to.equal(expectedEventSig);

      expect(await router.owner()).to.equal(router.address);
    });

    it('should not execute diamond cut when caller is not owner', async () => {
      const diamondCut = [
        { facetAddress: ethers.constants.AddressZero, action: 2, functionSelectors: getSelectors(router) }
      ];

      const expectedRevertMessage = 'LibDiamond: Must be contract owner';
      await expect(router.connect(nonMember).diamondCut(diamondCut, ethers.constants.AddressZero, '0x')).to.be.revertedWith(expectedRevertMessage);
    });

    it('should add pausability functionality', async () => {
      const expectedContractAddress = ethers.utils.getContractAddress(
        {
          from: router.address,
          nonce: await owner.provider.getTransactionCount(router.address)
        });

      await router.deployWrappedToken(1, nativeToken.address,
        { name: wrappedTokenName, symbol: wrappedTokenSymbol, decimals: wrappedTokenDecimals });

      const wrappedToken = wrappedTokenFactory.attach(expectedContractAddress);

      const pausabilityFacetFactory = await ethers.getContractFactory('PausabilityFacet');
      const pausabilityFacet = await pausabilityFacetFactory.deploy();
      await pausabilityFacet.deployed();

      const diamondCut = [
        { facetAddress: pausabilityFacet.address, action: 0, functionSelectors: getSelectors(pausabilityFacet) }
      ];

      await expect(router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x')).to.not.be.reverted;
      const contract = await diamondAsFacet(diamond, 'PausabilityFacet');
      await expect(contract.unpause(wrappedToken.address)).to.be.revertedWith('Pausable: not paused');
      await contract.pause(wrappedToken.address);

      expect(await wrappedToken.paused()).to.be.true;

      await contract.unpause(wrappedToken.address);
      expect(await wrappedToken.paused()).to.be.false;
    });

    it('should revert when initializing diamond cut with empty calldata', async () => {
      const expectedRevertMessage = 'LibDiamondCut: _calldata is empty but _init is not address(0)';
      await expect(router.diamondCut([], bob.address, '0x')).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert when initializing diamond cut with contract code', async () => {
      const expectedRevertMessage = 'LibDiamondCut: _init address has no code';
      await expect(router.diamondCut([], bob.address, '0x1231')).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert when trying to diamond cut with invalid action', async () => {
      const invalidAction = 4;

      const diamondCut = [
        { facetAddress: nonMember.address, action: invalidAction, functionSelectors: getSelectors(router) }
      ];

      await expect(router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x')).to.be.reverted;
    });
  });

  describe('Members Gas Usages', async () => {
    beforeEach(async () => {
      await nativeToken.mint(nonMember.address, amount);
      await nativeToken.connect(nonMember).approve(router.address, amount);
    });

    it('adds member with zero existing tokens', async () => {
      await router.updateMember(bob.address, true);
    });

    it('adds member with one existing token', async () => {
      await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address);

      await router.updateMember(bob.address, true);
    });

    it('adds member with two existing tokens', async () => {
      // given
      const otherNativeToken = await nativeTokenFactory.deploy('OtherNativeToken', 'NT', 18);
      await otherNativeToken.deployed();
      await otherNativeToken.mint(nonMember.address, amount);
      await otherNativeToken.connect(nonMember).approve(router.address, amount);

      await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.updateNativeToken(otherNativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address);
      await router.connect(nonMember).lock(1, otherNativeToken.address, amount, owner.address);

      // when
      await router.updateMember(bob.address, true);
    });
  });
});
