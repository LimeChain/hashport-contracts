const chai = require('chai');
const { ethers, waffle, network } = require('hardhat');
chai.use(waffle.solidity);
const expect = chai.expect;

const { createPermit, diamondAsFacet, getInterfaceId, getSelectors } = require('../util');

const enumFeeType = {
  Flat: 0,
  Percentage: 1
}

const enumFacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
}

describe('Router', async () => {
  let nativeToken;
  let nativeTokenFactory;
  let wrappedTokenFactory;
  let diamond;
  let router;
  let routerFacet;
  let ownershipFacet;
  let pausableFacet;
  let governanceFacet;
  let feeCalculatorFacet;
  let cutFacet;
  let loupeFacet;
  let feePolicyFacet;
  let owner;
  let alice;
  let bob;
  let carol;
  let admin;
  let nonMember;
  let feePolicyUser_1;
  let feePolicyUser_2;
  let feePolicyUser_3;
  let feePolicyUser_4;

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

  before(async () => {
    [owner, alice, aliceAdmin, bob, bobAdmin, carol, carolAdmin, admin, nonMember, feePolicyUser_1, feePolicyUser_2, feePolicyUser_3, feePolicyUser_4] = await ethers.getSigners();

    nativeTokenFactory = await ethers.getContractFactory('Token');
    nativeToken = await nativeTokenFactory.deploy('NativeToken', 'NT', 18);
    await nativeToken.deployed();

    wrappedTokenFactory = await ethers.getContractFactory('WrappedToken');

    const routerFacetFactory = await ethers.getContractFactory('RouterFacet');
    routerFacet = await routerFacetFactory.deploy();
    await routerFacet.deployed();

    const pausableFacetFactory = await ethers.getContractFactory('PausableFacet');
    pausableFacet = await pausableFacetFactory.deploy();
    await pausableFacet.deployed();

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
      [pausableFacet.address, 0, getSelectors(pausableFacet)],
      [routerFacet.address, 0, getSelectors(routerFacet)],
    ];

    const args = [
      owner.address
    ];

    const diamondFactory = await ethers.getContractFactory('Router');
    diamond = await diamondFactory.deploy(diamondCut, args);
    await diamond.deployed();

    router = await ethers.getContractAt('IRouterDiamond', diamond.address);

    await router.initGovernance([alice.address], [aliceAdmin.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION);
    await router.initRouter();
    await router.initFeeCalculator(FEE_CALCULATOR_PRECISION);
  });

  beforeEach(async function () {
    snapshotId = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async function () {
    await ethers.provider.send('evm_revert', [snapshotId]);
  });

  describe('setup', async () => {
    it('should successfully deploy Router contract', async () => {
      expect(diamond.address).to.be.properAddress;
      expect(router.address).to.be.properAddress;
      expect(routerFacet.address).to.be.properAddress;
      expect(pausableFacet.address).to.be.properAddress;
      expect(ownershipFacet.address).to.be.properAddress;
      expect(feeCalculatorFacet.address).to.be.properAddress;
      expect(cutFacet.address).to.be.properAddress;
      expect(loupeFacet.address).to.be.properAddress;

      // Fee Calculator
      expect(await router.serviceFeePrecision()).to.equal(FEE_CALCULATOR_PRECISION);

      // Governance
      expect(await router.admin()).to.equal(ethers.constants.AddressZero);
      expect(await router.membersCount()).to.equal(1);
      expect(await router.isMember(alice.address)).to.be.true;
      expect(await router.memberAt(0)).to.equal(alice.address);
      expect(await router.memberAdmin(alice.address)).to.equal(aliceAdmin.address);

      expect(await router.membersPrecision()).to.equal(GOVERNANCE_PRECISION);
      expect(await router.membersPercentage()).to.equal(GOVERNANCE_PERCENTAGE);

      // Pausable
      expect(await router.paused()).to.be.false;

      // Ownership
      expect(await router.owner()).to.equal(owner.address);

      expect(await router.facetAddresses())
        .to.include(routerFacet.address)
        .to.include(pausableFacet.address)
        .to.include(ownershipFacet.address)
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
          case pausableFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(pausableFacet));
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

      await expect(testFacet.initGovernance([], [], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should not initialize RouterFacet twice', async () => {
      const expectedRevertMessage = 'RouterFacet: already initialized';
      await expect(router.initRouter()).to.be.revertedWith(expectedRevertMessage);
    });

    it('should not initialize GovernanceFacet twice', async () => {
      const expectedRevertMessage = 'GovernanceFacet: already initialized';
      await expect(router.initGovernance([alice.address], [aliceAdmin.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should not initialize GovernanceFacet when members length are different', async () => {
      const expectedRevertMessage = 'GovernanceFacet: not matching members length';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address], [], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
      await expect(testFacet.initGovernance([alice.address], [aliceAdmin.address, bobAdmin.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
      await expect(testFacet.initGovernance([alice.address, bob.address], [aliceAdmin.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if precision is 0', async () => {
      const expectedRevertMessage = 'GovernanceFacet: precision must not be zero';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address], [aliceAdmin.address], GOVERNANCE_PERCENTAGE, 0)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if percentage is more than precision', async () => {
      const expectedRevertMessage = 'GovernanceFacet: percentage must be less than precision';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address], [aliceAdmin.address], GOVERNANCE_PRECISION + 1, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if percentage is equal to precision', async () => {
      const expectedRevertMessage = 'GovernanceFacet: percentage must be less than precision';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address], [aliceAdmin.address], GOVERNANCE_PRECISION, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init with duplicate addresses as members', async () => {
      const expectedRevertMessage = 'LibGovernance: Account already added';
      const governanceFacetFactory = await ethers.getContractFactory('GovernanceFacet');
      const testFacet = await governanceFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initGovernance([alice.address, alice.address], [aliceAdmin.address, aliceAdmin.address], GOVERNANCE_PERCENTAGE, GOVERNANCE_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should not initialize FeeCalculatorFacet twice', async () => {
      const expectedRevertMessage = 'FeeCalculatorFacet: already initialized';
      await expect(router.initFeeCalculator(FEE_CALCULATOR_PRECISION)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert governance init if precision is below 10', async () => {
      const expectedRevertMessage = 'FeeCalculatorFacet: precision must not be single-digit';
      const feeCalculatorFacetFactory = await ethers.getContractFactory('FeeCalculatorFacet');
      const testFacet = await feeCalculatorFacetFactory.deploy();
      await testFacet.deployed();
      await expect(testFacet.initFeeCalculator(0)).to.be.revertedWith(expectedRevertMessage);
      await expect(testFacet.initFeeCalculator(9)).to.be.revertedWith(expectedRevertMessage);
    });
  });

  describe('GovernanceFacet', async () => {
    describe('updateAdmin', async () => {
      it('should update admin', async () => {
        await router.updateAdmin(admin.address);

        expect(await router.admin()).to.equal(admin.address);
      });

      it('should emit event', async () => {
        await expect(await router.updateAdmin(admin.address))
          .to.emit(router, 'AdminUpdated')
          .withArgs(ethers.constants.AddressZero, admin.address);
      });

      it('should revert when trying to execute transaction with not owner', async () => {
        const expectedRevertMessage = 'LibDiamond: Must be contract owner';
        await expect(router.connect(nonMember).updateAdmin(admin.address)).to.be.revertedWith(expectedRevertMessage);
      });
    });

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

      it('should revert when trying to set percentage to 0', async () => {
        const expectedRevertMessage = 'LibGovernance: percentage must not be 0';

        await expect(router.updateMembersPercentage(0)).to.be.revertedWith(expectedRevertMessage);
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
        await router.updateMember(bob.address, bobAdmin.address, true);

        const bobStatus = await router.isMember(bob.address);
        expect(bobStatus).to.be.true;

        const addressAtIndex = await router.memberAt(1);
        expect(addressAtIndex).to.equal(bob.address);

        const expectedCount = 2;
        expect(await router.membersCount()).to.equal(expectedCount);

        expect(await router.memberAdmin(bob.address)).to.equal(bobAdmin.address);
      });

      it('should emit add event', async () => {
        await expect(await router.updateMember(bob.address, bobAdmin.address, true))
          .to.emit(router, 'MemberUpdated')
          .withArgs(bob.address, true)
          .to.emit(router, 'MemberAdminUpdated')
          .withArgs(bob.address, bobAdmin.address);
      });

      it('should revert setting a member twice', async () => {
        const expectedRevertMessage = 'LibGovernance: Account already added';
        await expect(router.updateMember(alice.address, aliceAdmin.address, true)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when trying to remove the last member', async () => {
        const expectedRevertMessage = 'LibGovernance: contract would become memberless';
        await expect(router.updateMember(alice.address, aliceAdmin.address, false)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should remove a member', async () => {
        await router.updateMember(bob.address, bobAdmin.address, true);
        expect(await router.membersCount()).to.equal(2);

        await router.updateMember(alice.address, aliceAdmin.address, false);

        const aliceMember = await router.isMember(alice.address);

        expect(aliceMember).to.be.false;
        expect(await router.membersCount()).to.equal(1);
        expect(await router.memberAdmin(alice.address)).to.equal(ethers.constants.AddressZero);
      });

      it('should emit remove event', async () => {
        await router.updateMember(bob.address, bobAdmin.address, true);
        await expect(await router.updateMember(alice.address, aliceAdmin.address, false))
          .to.emit(router, 'MemberUpdated')
          .withArgs(alice.address, false)
          .to.emit(router, 'MemberAdminUpdated')
          .withArgs(alice.address, ethers.constants.AddressZero);
      });

      it('should revert removing a member twice', async () => {
        await router.updateMember(bob.address, bobAdmin.address, true);
        await router.updateMember(carol.address, carolAdmin.address, true);

        await router.updateMember(alice.address, aliceAdmin.address, false);
        const expectedRevertMessage = 'LibGovernance: Account is not a member';
        await expect(router.updateMember(alice.address, aliceAdmin.address, false)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when executing transaction with not owner', async () => {
        const expectedRevertMessage = 'LibDiamond: Must be contract owner';
        await expect(router.connect(nonMember).updateMember(alice.address, aliceAdmin.address, false)).to.be.revertedWith(expectedRevertMessage);
      });

      it('should correctly accrue fees after addition of a new member', async () => {
        // given
        const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
        await nativeToken.mint(nonMember.address, amount);

        await nativeToken.connect(nonMember).approve(router.address, amount);
        await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);

        const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
        expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
        expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

        // when
        await router.updateMember(bob.address, bobAdmin.address, true);

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

        await router.updateMember(bob.address, bobAdmin.address, true);
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
        await nativeToken.mint(nonMember.address, amount);

        await nativeToken.connect(nonMember).approve(router.address, amount);
        await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);

        const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
        expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
        expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

        // when
        await expect(
          router.updateMember(alice.address, aliceAdmin.address, false))
          .to.emit(router, 'MemberUpdated')
          .withArgs(alice.address, false)
          .to.emit(router, 'MemberAdminUpdated')
          .withArgs(alice.address, ethers.constants.AddressZero)
          .to.emit(nativeToken, 'Transfer')
          .withArgs(router.address, aliceAdmin.address, rewardPerMember);

        const afterMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(afterMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
        expect(afterMemberUpdateTokenFeeData.accumulator).to.equal(rewardPerMember);
        expect(afterMemberUpdateTokenFeeData.previousAccrued).to.equal(afterMemberUpdateTokenFeeData.feesAccrued);

        expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(rewardPerMember);
      });
    });

    describe('updateMemberAdmin', async () => {
      it('should update member admin', async () => {
        await router.connect(aliceAdmin).updateMemberAdmin(alice.address, nonMember.address);

        expect(await router.memberAdmin(alice.address)).to.equal(nonMember.address);
      });

      it('should emit event with args', async () => {
        await expect(router.connect(aliceAdmin).updateMemberAdmin(alice.address, nonMember.address))
          .to.emit(router, 'MemberAdminUpdated')
          .withArgs(alice.address, nonMember.address);
      });

      it('should revert when member is not an actual member', async () => {
        const expectedRevertMessage = 'GovernanceFacet: _member is not an actual member';

        await expect(router.updateMemberAdmin(nonMember.address, aliceAdmin.address))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when caller is not the previous admin', async () => {
        const expectedRevertMessage = 'GovernanceFacet: caller is not the old admin';

        await expect(router.connect(nonMember).updateMemberAdmin(alice.address, aliceAdmin.address))
          .to.be.revertedWith(expectedRevertMessage);
      });
    });

    describe('hasValidSignaturesLength', async () => {
      beforeEach(async () => {
        await router.updateMember(bob.address, bobAdmin.address, true);
        await router.updateMember(carol.address, carolAdmin.address, true);
      });
      it('should have valid signatures length', async () => {
        await expect(await router.hasValidSignaturesLength(2)).to.be.true;
        await expect(await router.hasValidSignaturesLength(3)).to.be.true;
      });

      it('should have invalid signatures length', async () => {
        await expect(await router.hasValidSignaturesLength(1)).to.be.false;
        await expect(await router.hasValidSignaturesLength(4)).to.be.false;
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

  describe('PausableFacet', async () => {
    beforeEach(async () => {
      await router.updateAdmin(admin.address);
    });

    it('should pause successfully', async () => {
      await router.pause();

      expect(await router.paused()).to.be.true;
    });

    it('should emit pause event', async () => {
      await expect(router.connect(admin).pause())
        .to.emit(router, 'Paused')
        .withArgs(admin.address);
    });

    it('should unpause successfully', async () => {
      // given
      await router.connect(admin).pause();

      // when
      await router.connect(admin).unpause();

      // then
      expect(await router.paused()).to.be.false;
    });

    it('should emit unpause event', async () => {
      // given
      await router.pause()
      // then
      await expect(router.connect(admin).unpause())
        .to.emit(router, 'Unpaused')
        .withArgs(admin.address);
    });

    it('should revert pause when already paused', async () => {
      const expectedRevertMessage = 'LibGovernance: paused';
      // given
      await router.pause();

      await expect(router.connect(admin).pause())
        .to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert unpause when already unpaused', async () => {
      const expectedRevertMessage = 'LibGovernance: not paused';

      await expect(router.connect(admin).unpause())
        .to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert pause when caller is neither owner, nor admin', async () => {
      const expectedRevertMessage = 'PausableFacet: unauthorized';

      await expect(router.connect(nonMember).unpause())
        .to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert unpause when caller is neither owner, nor admin', async () => {
      const expectedRevertMessage = 'PausableFacet: unauthorized';

      await expect(router.connect(nonMember).unpause())
        .to.be.revertedWith(expectedRevertMessage);
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

        const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

        await router.connect(nonMember).lock(1, nativeToken.address, amount, receiver, serviceFee);

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(serviceFee);

        const routerBalance = await nativeToken.balanceOf(router.address);
        expect(routerBalance).to.equal(amount);
      });

      it('should emit event with args', async () => {
        await nativeToken.connect(nonMember).approve(router.address, amount);
        const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

        await expect(await router
          .connect(nonMember)
          .lock(1, nativeToken.address, amount, receiver, serviceFee))
          .to.emit(router, 'Lock')
          .withArgs(1, nativeToken.address, receiver.toLowerCase(), amount, serviceFee);
      });

      it('should revert if not enough tokens are approved', async () => {
        const expectedRevertMessage = 'ERC20: transfer amount exceeds allowance';
        await expect(
          router.connect(nonMember).lock(1, nativeToken.address, amount, receiver, 1))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when contract is paused', async () => {
        // given
        const expectedRevertMessage = 'LibGovernance: paused';
        await router.updateAdmin(admin.address);
        await router.connect(admin).pause();

        // then
        await expect(router
          .connect(nonMember)
          .lock(1, nativeToken.address, amount, receiver, 1))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should lock with permit', async () => {
        const permit = await createPermit(nonMember, router.address, amount, permitDeadline, nativeToken);
        const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

        await router.connect(nonMember).lockWithPermit(1, nativeToken.address, amount, receiver, permitDeadline, permit.v, permit.r, permit.s, serviceFee);

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(serviceFee);

        const routerBalance = await nativeToken.balanceOf(router.address);
        expect(routerBalance).to.equal(amount);

        expect(await nativeToken.nonces(nonMember.address)).to.equal(1);
      });

      it('should revert lock with permit when contract is paused', async () => {
        // given
        const expectedRevertMessage = 'LibGovernance: paused';
        const permit = await createPermit(nonMember, router.address, amount, permitDeadline, nativeToken);
        await router.updateAdmin(admin.address);
        await router.connect(admin).pause();

        // then
        await expect(router
          .connect(nonMember)
          .lockWithPermit(1, nativeToken.address, amount, receiver, permitDeadline, permit.v, permit.r, permit.s, 1))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when native token is not found', async () => {
        const expectedRevertMessage = 'RouterFacet: native token not found';
        const notAddedNativeToken = await (await ethers.getContractFactory('Token')).deploy('NativeToken', 'NT', 18);
        const permit = await createPermit(nonMember, router.address, amount, permitDeadline, notAddedNativeToken);
        await expect(
          router
            .connect(nonMember)
            .lockWithPermit(1, notAddedNativeToken.address, amount, receiver, permitDeadline, permit.v, permit.r, permit.s, 1))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should lock properly with zero service fee', async () => {
        await nativeToken.connect(nonMember).approve(router.address, amount);
        await router.setServiceFee(nativeToken.address, 0);

        await expect(await router
          .connect(nonMember)
          .lock(1, nativeToken.address, amount, receiver, 0))
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

        await router.updateMember(bob.address, bobAdmin.address, true);
        await router.updateMember(carol.address, carolAdmin.address, true);

        receiver = owner.address;

        const encodeData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes', 'address', 'address', 'uint256'], [1, chainId, transactionId, nativeToken.address, receiver, amount]);
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

        await expect(router.connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided signatures contains signed from non-member', async () => {
        const expectedRevertMessage = 'LibGovernance: invalid signer';
        const nonMemberSignature = await nonMember.signMessage(hashData);

        await expect(router.connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature, nonMemberSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided signatures are duplicate', async () => {
        const expectedRevertMessage = 'LibGovernance: duplicate signatures';

        await expect(router.connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, amount, receiver, [aliceSignature, aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided data is invalid', async () => {
        const expectedRevertMessage = 'Governance: invalid signer';
        await expect(router.connect(nonMember)
          .unlock(1, transactionId, nativeToken.address, 1, receiver, [aliceSignature, bobSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when contract is paused', async () => {
        // given
        const expectedRevertMessage = 'LibGovernance: paused';
        await router.updateAdmin(admin.address);
        await router.connect(admin).pause();
        // then
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

    describe('unlockWithFee', async () => {
      let receiver;
      let hashData;

      let aliceSignature;
      let bobSignature;
      let carolSignature;

      const calculatedFee = ethers.utils.parseEther('1');

      beforeEach(async () => {
        await nativeToken.mint(router.address, amount);
        await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);

        await router.updateMember(bob.address, bobAdmin.address, true);
        await router.updateMember(carol.address, carolAdmin.address, true);

        receiver = owner.address;

        const encodeData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes', 'address', 'address', 'uint256', 'uint256'], [1, chainId, transactionId, nativeToken.address, receiver, amount, calculatedFee]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        hashData = ethers.utils.arrayify(hashMsg);

        aliceSignature = await alice.signMessage(hashData);
        bobSignature = await bob.signMessage(hashData);
        carolSignature = await carol.signMessage(hashData);
      });

      it('should execute unlock', async () => {
        await router
          .connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, calculatedFee, [aliceSignature, bobSignature, carolSignature]);

        const balanceOfReceiver = await nativeToken.balanceOf(receiver);
        expect(balanceOfReceiver).to.equal(amount.sub(calculatedFee));

        expect(await router.hashesUsed(ethers.utils.hashMessage(hashData))).to.be.true;

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(calculatedFee);
      });

      it('should execute unlock with service fee', async () => {
        const tetLargeCalculatedFee = ethers.utils.parseEther('50');
        const expectedFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

        const encodeData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes', 'address', 'address', 'uint256', 'uint256'], [1, chainId, transactionId, nativeToken.address, receiver, amount, tetLargeCalculatedFee]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        const _hashData = ethers.utils.arrayify(hashMsg);

        const _aliceSignature = await alice.signMessage(_hashData);
        const _bobSignature = await bob.signMessage(_hashData);
        const _carolSignature = await carol.signMessage(_hashData);

        await router
          .connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, tetLargeCalculatedFee, [_aliceSignature, _bobSignature, _carolSignature]);

        const balanceOfReceiver = await nativeToken.balanceOf(receiver);
        expect(balanceOfReceiver).to.equal(amount.sub(expectedFee));

        expect(await router.hashesUsed(ethers.utils.hashMessage(_hashData))).to.be.true;

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(expectedFee);
      });

      it('should execute unlock with service fee if calculated fee is zero', async () => {
        const tetLargeCalculatedFee = 0;
        const expectedFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

        const encodeData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes', 'address', 'address', 'uint256', 'uint256'], [1, chainId, transactionId, nativeToken.address, receiver, amount, tetLargeCalculatedFee]);
        const hashMsg = ethers.utils.keccak256(encodeData);
        const _hashData = ethers.utils.arrayify(hashMsg);

        const _aliceSignature = await alice.signMessage(_hashData);
        const _bobSignature = await bob.signMessage(_hashData);
        const _carolSignature = await carol.signMessage(_hashData);

        await router
          .connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, tetLargeCalculatedFee, [_aliceSignature, _bobSignature, _carolSignature]);

        const balanceOfReceiver = await nativeToken.balanceOf(receiver);
        expect(balanceOfReceiver).to.equal(amount);

        expect(await router.hashesUsed(ethers.utils.hashMessage(_hashData))).to.be.true;

        const tokenFeeData = await router.tokenFeeData(nativeToken.address);
        expect(tokenFeeData.feesAccrued).to.equal(0);
      });

      it('should emit event with args', async () => {
        const transferAmount = amount.sub(calculatedFee);
        const sourceChainId = 1;

        await expect(await router
          .connect(nonMember)
          .unlockWithFee(sourceChainId, transactionId, nativeToken.address, amount, receiver, calculatedFee, [aliceSignature, bobSignature, carolSignature]))
          .to.emit(router, 'Unlock')
          .withArgs(sourceChainId, transactionId, nativeToken.address, transferAmount, receiver, calculatedFee);
      });

      it('should revert when trying to execute same unlock transaction twice', async () => {
        const expectedRevertMessage = 'RouterFacet: transaction already submitted';
        await router
          .connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, calculatedFee, [aliceSignature, bobSignature, carolSignature]);

        await expect(router
          .connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, calculatedFee, [aliceSignature, bobSignature, carolSignature]))
          .to.be.revertedWith(expectedRevertMessage);

      });

      it('should revert when provided signatures are not enough', async () => {
        const expectedRevertMessage = 'LibGovernance: Invalid number of signatures';

        await expect(router.connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, calculatedFee, [aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided signatures contains signed from non-member', async () => {
        const expectedRevertMessage = 'LibGovernance: invalid signer';
        const nonMemberSignature = await nonMember.signMessage(hashData);

        await expect(router.connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, calculatedFee, [aliceSignature, nonMemberSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided signatures are duplicate', async () => {
        const expectedRevertMessage = 'LibGovernance: duplicate signatures';

        await expect(router.connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, amount, receiver, calculatedFee, [aliceSignature, aliceSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when provided data is invalid', async () => {
        const expectedRevertMessage = 'Governance: invalid signer';
        await expect(router.connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, 1, receiver, calculatedFee, [aliceSignature, bobSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when contract is paused', async () => {
        // given
        const expectedRevertMessage = 'LibGovernance: paused';
        await router.updateAdmin(admin.address);
        await router.connect(admin).pause();
        // then
        await expect(router.connect(nonMember)
          .unlockWithFee(1, transactionId, nativeToken.address, 1, receiver, calculatedFee, [aliceSignature, bobSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when native token is not found', async () => {
        const expectedRevertMessage = 'RouterFacet: native token not found';
        await expect(router.connect(nonMember)
          .unlockWithFee(1, transactionId, bob.address, 1, receiver, calculatedFee, [aliceSignature, bobSignature]))
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
        await router.updateMember(bob.address, bobAdmin.address, true);
        await router.updateMember(carol.address, carolAdmin.address, true);

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

      it('should revert when contract is paused', async () => {
        // given
        const expectedRevertMessage = 'LibGovernance: paused';
        await router.updateAdmin(admin.address);
        await router.connect(admin).pause();

        // then
        await expect(router.connect(nonMember).mint(
          1,
          transactionId,
          wrappedToken.address,
          receiver,
          amount,
          [aliceSignature, bobSignature]))
          .to.be.revertedWith(expectedRevertMessage);
      });

      describe('pausability/ownership on tokens', async () => {
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
        const expectedRevertMessage = 'ERC20: burn amount exceeds allowance';
        await wrappedToken.transferOwnership(router.address);
        await expect(router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert when router cannot burn', async () => {
        const expectedRevertMessage = 'Ownable: caller is not the owner';
        await expect(router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert burn when contract is paused', async () => {
        // given
        const expectedRevertMessage = 'LibGovernance: paused';
        await router.updateAdmin(admin.address);
        await router.connect(admin).pause();
        // then
        await expect(router.connect(nonMember).burn(1, wrappedToken.address, amount, receiver))
          .to.be.revertedWith(expectedRevertMessage);
      });

      it('should revert burn with permit when contract is paused', async () => {
        // given
        const expectedRevertMessage = 'LibGovernance: paused';
        const permit = await createPermit(nonMember, router.address, amount, permitDeadline, wrappedToken);
        await router.updateAdmin(admin.address);
        await router.connect(admin).pause();
        // then
        await expect(router.connect(nonMember)
          .burnWithPermit(1, wrappedToken.address, amount, receiver, permitDeadline, permit.v, permit.r, permit.s))
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

  describe('claim', async () => {
    let serviceFee;
    let expectedMemberFeeRewardAfterClaim;
    let expectedPrevAccruedAfterClaim;
    beforeEach(async () => {
      await nativeToken.mint(nonMember.address, amount);
      await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.updateMember(bob.address, bobAdmin.address, true);
      await router.updateMember(carol.address, carolAdmin.address, true);

      serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

      await nativeToken.connect(nonMember).approve(router.address, amount);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);

      expectedMemberFeeRewardAfterClaim = serviceFee.div(3);
      expectedPrevAccruedAfterClaim = expectedMemberFeeRewardAfterClaim.mul(3);
    });

    it('should claim service fees for native token', async () => {
      // when
      await router.connect(alice).claim(nativeToken.address, alice.address);

      // then
      const aliceAdminBalance = await nativeToken.balanceOf(aliceAdmin.address);
      const bobAdminBalance = await nativeToken.balanceOf(bobAdmin.address);
      const carolAdminBalance = await nativeToken.balanceOf(carolAdmin.address);
      const routerBalance = await nativeToken.balanceOf(router.address);

      const aliceClaimedRewards = await router.claimedRewardsPerAccount(alice.address, nativeToken.address);
      const bobClaimedRewards = await router.claimedRewardsPerAccount(bob.address, nativeToken.address);
      const carolClaimedRewards = await router.claimedRewardsPerAccount(carol.address, nativeToken.address);

      expect(aliceAdminBalance)
        .to.equal(expectedMemberFeeRewardAfterClaim)
        .to.equal(aliceClaimedRewards);
      expect(bobAdminBalance)
        .to.equal(0)
        .to.equal(bobClaimedRewards);
      expect(carolAdminBalance)
        .to.equal(0)
        .to.equal(carolClaimedRewards);
      expect(routerBalance)
        .to.equal(amount.sub(expectedMemberFeeRewardAfterClaim));

      const tokenFeeData = await router.tokenFeeData(nativeToken.address);

      expect(tokenFeeData.feesAccrued).to.equal(serviceFee);
      expect(tokenFeeData.previousAccrued).to.equal(expectedPrevAccruedAfterClaim);
      expect(
        tokenFeeData.feesAccrued
          .sub(tokenFeeData.previousAccrued))
        .equal(
          serviceFee.sub(expectedPrevAccruedAfterClaim));
      expect(tokenFeeData.accumulator).to.equal(serviceFee.div(3));
    });

    it('should claim multiple fees per members', async () => {
      // given
      await nativeToken.mint(nonMember.address, amount);
      await nativeToken.connect(nonMember).approve(router.address, amount);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);

      serviceFee = serviceFee.mul(2);
      expectedMemberFeeRewardAfterClaim = serviceFee.div(3);
      expectedPrevAccruedAfterClaim = expectedMemberFeeRewardAfterClaim.mul(3);

      // when
      await router.connect(alice).claim(nativeToken.address, alice.address);
      await router.connect(bob).claim(nativeToken.address, bob.address);
      await router.connect(carol).claim(nativeToken.address, carol.address);

      // then
      const aliceAdminBalance = await nativeToken.balanceOf(aliceAdmin.address);
      const bobAdminBalance = await nativeToken.balanceOf(bobAdmin.address);
      const caroAdminlBalance = await nativeToken.balanceOf(carolAdmin.address);
      const routerBalance = await nativeToken.balanceOf(router.address);

      const aliceClaimedRewards = await router.claimedRewardsPerAccount(alice.address, nativeToken.address);
      const bobClaimedRewards = await router.claimedRewardsPerAccount(bob.address, nativeToken.address);
      const carolClaimedRewards = await router.claimedRewardsPerAccount(carol.address, nativeToken.address);

      expect(aliceAdminBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(aliceClaimedRewards);
      expect(bobAdminBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(bobClaimedRewards);
      expect(caroAdminlBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(carolClaimedRewards);
      expect(routerBalance)
        .to.equal(amount.mul(2).sub(expectedPrevAccruedAfterClaim));

      const tokenFeeData = await router.tokenFeeData(nativeToken.address);

      expect(tokenFeeData.feesAccrued).to.equal(serviceFee);
      expect(tokenFeeData.previousAccrued).to.equal(expectedPrevAccruedAfterClaim);
      expect(
        tokenFeeData.feesAccrued
          .sub(tokenFeeData.previousAccrued))
        .equal(
          serviceFee.sub(expectedPrevAccruedAfterClaim));
      expect(tokenFeeData.accumulator).to.equal(serviceFee.div(3));
    });

    it('should have the same fees accrued and previously, having no remainder', async () => {
      // beforeEach -> 100 tokens amount -> 10 tokens fee -> 10 / 3 tokens per member -> 1 token remainder left

      const secondAmount = ethers.utils.parseEther('20');
      // lock one more time, this time with an amount which will make the fees accrued equally, with no remainder
      // add another lock -> 20 tokens -> 2 tokens fee -> (1 from previous + 2) tokens per member -> 0 left

      const secondServiceFee = secondAmount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

      await nativeToken.mint(nonMember.address, secondAmount);
      await nativeToken.connect(nonMember).approve(router.address, secondAmount);
      await router.connect(nonMember).lock(1, nativeToken.address, secondAmount, owner.address, secondServiceFee);

      const totalLockedAmount = amount.add(secondAmount);
      serviceFee = totalLockedAmount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
      expectedMemberFeeRewardAfterClaim = serviceFee.div(3);
      expectedPrevAccruedAfterClaim = expectedMemberFeeRewardAfterClaim.mul(3);

      // when
      await router.connect(alice).claim(nativeToken.address, alice.address);
      await router.connect(bob).claim(nativeToken.address, bob.address);
      await router.connect(carol).claim(nativeToken.address, carol.address);

      // then
      const aliceAdminBalance = await nativeToken.balanceOf(aliceAdmin.address);
      const bobAdminBalance = await nativeToken.balanceOf(bobAdmin.address);
      const carolAdminBalance = await nativeToken.balanceOf(carolAdmin.address);
      const routerBalance = await nativeToken.balanceOf(router.address);

      const aliceClaimedRewards = await router.claimedRewardsPerAccount(alice.address, nativeToken.address);
      const bobClaimedRewards = await router.claimedRewardsPerAccount(bob.address, nativeToken.address);
      const carolClaimedRewards = await router.claimedRewardsPerAccount(carol.address, nativeToken.address);

      expect(aliceAdminBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(aliceClaimedRewards);
      expect(bobAdminBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(bobClaimedRewards);
      expect(carolAdminBalance)
        .to.equal(serviceFee.div(3))
        .to.equal(carolClaimedRewards);
      expect(routerBalance)
        .to.equal(totalLockedAmount.sub(expectedPrevAccruedAfterClaim));

      const tokenFeeData = await router.tokenFeeData(nativeToken.address);

      expect(tokenFeeData.feesAccrued)
        .to.equal(serviceFee)
        .to.equal(tokenFeeData.previousAccrued)
        .to.equal(expectedPrevAccruedAfterClaim);
      expect(tokenFeeData.accumulator).to.equal(serviceFee.div(3));
    });

    it('should emit event with args', async () => {
      const claimAmount = serviceFee.div(3);
      await expect(router.claim(nativeToken.address, alice.address))
        .to.emit(router, 'Claim')
        .withArgs(alice.address, aliceAdmin.address, nativeToken.address, claimAmount)
        .to.emit(nativeToken, 'Transfer')
        .withArgs(router.address, aliceAdmin.address, claimAmount);
    });

    it('should revert when claimed address is not a member', async () => {
      const expectedRevertMessage = 'FeeCalculatorFacet: _member is not a member';
      await expect(router.claim(nativeToken.address, nonMember.address)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should revert when contract is paused', async () => {
      const expectedRevertMessage = 'LibGovernance: paused';
      // given
      await router.updateAdmin(admin.address);
      await router.connect(admin).pause();
      // then
      await expect(router.claim(nativeToken.address, alice.address)).to.be.revertedWith(expectedRevertMessage);
    });

    it('should have been claimed after member removal', async () => {
      const claimAmount = serviceFee.div(3);
      await expect(router.updateMember(alice.address, ethers.constants.AddressZero, false))
        .to.emit(nativeToken, 'Transfer')
        .withArgs(router.address, aliceAdmin.address, claimAmount);

      const aliceAdminBalance = await nativeToken.balanceOf(aliceAdmin.address);
      const aliceClaimedRewards = await router.claimedRewardsPerAccount(alice.address, nativeToken.address);
      expect(aliceAdminBalance)
        .to.equal(claimAmount)
        .to.equal(aliceClaimedRewards);

      const tokenFeeData = await router.tokenFeeData(nativeToken.address);

      expect(tokenFeeData.feesAccrued).to.equal(serviceFee);
      expect(tokenFeeData.previousAccrued).to.equal(expectedPrevAccruedAfterClaim);
      expect(
        tokenFeeData.feesAccrued
          .sub(tokenFeeData.previousAccrued))
        .equal(
          serviceFee.sub(expectedPrevAccruedAfterClaim));
      expect(tokenFeeData.accumulator).to.equal(serviceFee.div(3));
    });
  });

  describe('ERC-721 support', async () => {
    let paymentFacet; // Actual PaymentFacet Contract
    let payment; // Wrapped Diamond contract to a IPayment
    const tokenID = 1;
    const metadata = 'https://hello.zyx/1';
    const ERC721BurnFee = ethers.utils.parseEther('1');

    beforeEach(async () => {
      const paymentFacetFactory = await ethers.getContractFactory('PaymentFacet');
      paymentFacet = await paymentFacetFactory.deploy();
      await paymentFacet.deployed();

      // Diamond cut to add Payment Facet
      const diamondAddCut = [{
        facetAddress: paymentFacet.address,
        action: 0, // Add
        functionSelectors: getSelectors(paymentFacet),
      }];

      await router.diamondCut(diamondAddCut, ethers.constants.AddressZero, "0x");

      payment = await ethers.getContractAt('IPayment', diamond.address);
    });

    describe('PaymentFacet', async () => {
      it('should diamond cut successfully', async () => {
        expect(await router.facetAddresses())
          .to.include(routerFacet.address)
          .to.include(pausableFacet.address)
          .to.include(ownershipFacet.address)
          .to.include(feeCalculatorFacet.address)
          .to.include(cutFacet.address)
          .to.include(loupeFacet.address)
          .to.include(paymentFacet.address);

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
            case pausableFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(pausableFacet));
              break;
            case routerFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(routerFacet));
              break;
            case paymentFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(paymentFacet));
              break;
            default:
              throw 'invalid facet address'
          }
        }

        expect(await payment.totalPaymentTokens()).to.equal(0);
      });

      describe('setPaymentToken', async () => {
        it('should add token payment', async () => {
          // when
          await payment.setPaymentToken(nativeToken.address, true);

          // then
          expect(await payment.supportsPaymentToken(nativeToken.address)).to.be.true;
          expect(await payment.totalPaymentTokens()).to.equal(1);
          expect(await payment.paymentTokenAt(0)).to.equal(nativeToken.address);
        });

        it('should emit event with args', async () => {
          await expect(payment.setPaymentToken(nativeToken.address, true))
            .to.emit(payment, 'SetPaymentToken')
            .withArgs(nativeToken.address, true);
        });

        it('should remove token payment', async () => {
          // given
          await payment.setPaymentToken(nativeToken.address, true);

          // when
          await payment.setPaymentToken(nativeToken.address, false);

          // then
          expect(await payment.supportsPaymentToken(nativeToken.address)).to.be.false;
          expect(await payment.totalPaymentTokens()).to.equal(0);
          await expect(payment.paymentTokenAt(0)).to.be.reverted;
        });

        it('should revert when token payment is 0x0', async () => {
          const expectedRevertMessage = 'PaymentFacet: _token must not be 0x0';
          // when
          await expect(payment.setPaymentToken(ethers.constants.AddressZero, true))
            .to.be.revertedWith(expectedRevertMessage);
          // and
          await expect(payment.setPaymentToken(ethers.constants.AddressZero, false))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when caller is not owner', async () => {
          const expectedRevertMessage = 'LibDiamond: Must be contract owner';
          // when
          await expect(payment.connect(alice).setPaymentToken(nativeToken.address, false))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when token payment is already added', async () => {
          // given
          const expectedRevertMessage = 'LibPayment: payment token already added';
          await payment.setPaymentToken(nativeToken.address, true);

          // when
          await expect(payment.setPaymentToken(nativeToken.address, true))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when token payment is already removed/never added', async () => {
          const expectedRevertMessage = 'LibPayment: payment token not found';

          // when
          await expect(payment.setPaymentToken(nativeToken.address, false))
            .to.be.revertedWith(expectedRevertMessage);
        });
      });
    });

    describe('GovernanceV2', async () => {
      let governanceV2Facet;
      const updatedFunction = 'updateMember(address,address,bool)';

      beforeEach(async () => {
        const governanceV2Factory = await ethers.getContractFactory('GovernanceV2Facet');
        governanceV2Facet = await governanceV2Factory.deploy();
        await governanceV2Facet.deployed();

        // Diamond cut to replace Payment Facet
        const diamondReplaceCut = [{
          facetAddress: governanceV2Facet.address,
          action: 1, // Replace
          functionSelectors: getSelectors(governanceV2Facet),
        }];

        await router.diamondCut(diamondReplaceCut, ethers.constants.AddressZero, "0x");
      });

      it('should diamond cut successfully', async () => {
        const sigHash = governanceFacet.interface.getSighash(updatedFunction);

        expect(await router.facetAddresses())
          .to.include(routerFacet.address)
          .to.include(pausableFacet.address)
          .to.include(ownershipFacet.address)
          .to.include(feeCalculatorFacet.address)
          .to.include(cutFacet.address)
          .to.include(loupeFacet.address)
          .to.include(paymentFacet.address)
          .to.include(governanceV2Facet.address);

        const expectedGovernanceSelectors = getSelectors(governanceFacet)
          .filter(selector => selector !== sigHash)
          .sort();

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
              const sorted = facet.functionSelectors.slice().sort();
              expect(sorted).to.deep.equal(expectedGovernanceSelectors);
              break;
            case ownershipFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(ownershipFacet));
              break;
            case pausableFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(pausableFacet));
              break;
            case routerFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(routerFacet));
              break;
            case paymentFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(paymentFacet));
              break;
            case governanceV2Facet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(governanceV2Facet));
              break;
            default:
              throw 'invalid facet address'
          }
        }
      });

      describe('updateMember', async () => {
        it('should add a member', async () => {
          await router.updateMember(bob.address, bobAdmin.address, true);

          const bobStatus = await router.isMember(bob.address);
          expect(bobStatus).to.be.true;

          const addressAtIndex = await router.memberAt(1);
          expect(addressAtIndex).to.equal(bob.address);

          const expectedCount = 2;
          expect(await router.membersCount()).to.equal(expectedCount);

          expect(await router.memberAdmin(bob.address)).to.equal(bobAdmin.address);
        });

        it('should emit add event', async () => {
          await expect(await router.updateMember(bob.address, bobAdmin.address, true))
            .to.emit(router, 'MemberUpdated')
            .withArgs(bob.address, true)
            .to.emit(router, 'MemberAdminUpdated')
            .withArgs(bob.address, bobAdmin.address);
        });

        it('should revert setting a member twice', async () => {
          const expectedRevertMessage = 'LibGovernance: Account already added';
          await expect(router.updateMember(alice.address, aliceAdmin.address, true)).to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when trying to remove the last member', async () => {
          const expectedRevertMessage = 'LibGovernance: contract would become memberless';
          await expect(router.updateMember(alice.address, aliceAdmin.address, false)).to.be.revertedWith(expectedRevertMessage);
        });

        it('should remove a member', async () => {
          await router.updateMember(bob.address, bobAdmin.address, true);
          expect(await router.membersCount()).to.equal(2);

          await router.updateMember(alice.address, aliceAdmin.address, false);

          const aliceMember = await router.isMember(alice.address);

          expect(aliceMember).to.be.false;
          expect(await router.membersCount()).to.equal(1);
          expect(await router.memberAdmin(alice.address)).to.equal(ethers.constants.AddressZero);
        });

        it('should emit remove event', async () => {
          await router.updateMember(bob.address, bobAdmin.address, true);
          await expect(await router.updateMember(alice.address, aliceAdmin.address, false))
            .to.emit(router, 'MemberUpdated')
            .withArgs(alice.address, false)
            .to.emit(router, 'MemberAdminUpdated')
            .withArgs(alice.address, ethers.constants.AddressZero);
        });

        it('should revert removing a member twice', async () => {
          await router.updateMember(bob.address, bobAdmin.address, true);
          await router.updateMember(carol.address, carolAdmin.address, true);

          await router.updateMember(alice.address, aliceAdmin.address, false);
          const expectedRevertMessage = 'LibGovernance: Account is not a member';
          await expect(router.updateMember(alice.address, aliceAdmin.address, false)).to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when executing transaction with not owner', async () => {
          const expectedRevertMessage = 'LibDiamond: Must be contract owner';
          await expect(router.connect(nonMember).updateMember(alice.address, aliceAdmin.address, false)).to.be.revertedWith(expectedRevertMessage);
        });

        it('should correctly accrue fees after addition of a new member', async () => {
          // given
          const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
          await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
          await nativeToken.mint(nonMember.address, amount);

          await nativeToken.connect(nonMember).approve(router.address, amount);
          await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

          // when
          await router.updateMember(bob.address, bobAdmin.address, true);

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

          await router.updateMember(bob.address, bobAdmin.address, true);
          await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
          await nativeToken.mint(nonMember.address, amount);

          await nativeToken.connect(nonMember).approve(router.address, amount);
          await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

          // when
          await expect(
            router.updateMember(alice.address, aliceAdmin.address, false))
            .to.emit(router, 'MemberUpdated')
            .withArgs(alice.address, false)
            .to.emit(router, 'MemberAdminUpdated')
            .withArgs(alice.address, ethers.constants.AddressZero)
            .to.emit(nativeToken, 'Transfer')
            .withArgs(router.address, aliceAdmin.address, rewardPerMember);

          const afterMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
          expect(afterMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
          expect(afterMemberUpdateTokenFeeData.accumulator).to.equal(rewardPerMember);
          expect(afterMemberUpdateTokenFeeData.previousAccrued).to.equal(afterMemberUpdateTokenFeeData.feesAccrued);

          expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(rewardPerMember);
        });

        describe('with ERC-721', async () => {
          let paymentToken;

          beforeEach(async () => {
            const erc721PortalFacetFactory = await ethers.getContractFactory('ERC721PortalFacet');
            erc721PortalFacet = await erc721PortalFacetFactory.deploy();
            await erc721PortalFacet.deployed();

            // Diamond cut to add ERC-721 Portal Facet
            const diamondAddCut = [{
              facetAddress: erc721PortalFacet.address,
              action: 0, // Add
              functionSelectors: getSelectors(erc721PortalFacet),
            }];

            await router.diamondCut(diamondAddCut, ethers.constants.AddressZero, "0x");

            erc721Portal = await ethers.getContractAt('IERC721PortalFacet', diamond.address);

            const wrappedERC721Factory = await ethers.getContractFactory('WrappedERC721');
            wrappedERC721 = await wrappedERC721Factory.deploy(wrappedTokenName, wrappedTokenSymbol);
            await wrappedERC721.deployed();
            await wrappedERC721.transferOwnership(router.address);

            paymentToken = await nativeTokenFactory.deploy('OtherNativeToken', 'NT', 18);
            await paymentToken.deployed();
            await paymentToken.mint(nonMember.address, amount);
            await payment.setPaymentToken(paymentToken.address, true);
          });

          it('should correctly accrue fees after addition of a new member when token payments exist', async () => {
            const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

            // given
            await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
            await nativeToken.mint(nonMember.address, amount);

            await nativeToken.connect(nonMember).approve(router.address, amount);
            await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);
            const receiver = nonMember.address;

            const encodeData = ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
              [1, chainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await alice.signMessage(hashData);

            // and
            await payment.setPaymentToken(nativeToken.address, true);
            await erc721Portal.setERC721Payment(wrappedERC721.address, nativeToken.address, ERC721BurnFee);
            // and
            await erc721Portal.mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature]);
            // and
            await nativeToken.mint(nonMember.address, amount);
            // and
            await nativeToken.connect(nonMember).approve(router.address, ERC721BurnFee);
            // and
            await wrappedERC721.connect(nonMember).approve(router.address, tokenID);
            // and
            await erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver);
            // and

            const totalAccrued = serviceFee.add(ERC721BurnFee);

            const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(totalAccrued);
            expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
            expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

            // when
            await router.updateMember(bob.address, bobAdmin.address, true);

            // then
            const afterMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(afterMemberUpdateTokenFeeData.feesAccrued).to.equal(totalAccrued);
            expect(afterMemberUpdateTokenFeeData.accumulator).to.equal(totalAccrued);
            expect(afterMemberUpdateTokenFeeData.previousAccrued).to.equal(afterMemberUpdateTokenFeeData.feesAccrued);

            expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(0);
            expect(await router.claimedRewardsPerAccount(bob.address, nativeToken.address)).to.equal(totalAccrued);
          });

          it('should correctly accrue fees after removal of a member when token payments exist', async () => {
            // given
            const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
            const totalAccrued = serviceFee.add(ERC721BurnFee);
            const rewardPerMember = totalAccrued.div(2);
            // and
            await router.updateMember(bob.address, bobAdmin.address, true);
            // and
            await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
            await nativeToken.mint(nonMember.address, amount);

            await nativeToken.connect(nonMember).approve(router.address, amount);
            await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);
            const receiver = nonMember.address;

            const encodeData = ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
              [1, chainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await alice.signMessage(hashData);

            // and
            await payment.setPaymentToken(nativeToken.address, true);
            await erc721Portal.setERC721Payment(wrappedERC721.address, nativeToken.address, ERC721BurnFee);
            // and
            await erc721Portal.mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature]);
            // and
            await nativeToken.mint(nonMember.address, amount);
            // and
            await nativeToken.connect(nonMember).approve(router.address, ERC721BurnFee);
            // and
            await wrappedERC721.connect(nonMember).approve(router.address, tokenID);
            // and
            await erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver);

            const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(totalAccrued);
            expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
            expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);

            // when
            await expect(
              router.updateMember(alice.address, aliceAdmin.address, false))
              .to.emit(router, 'MemberUpdated')
              .withArgs(alice.address, false)
              .to.emit(router, 'MemberAdminUpdated')
              .withArgs(alice.address, ethers.constants.AddressZero)
              .to.emit(nativeToken, 'Transfer')
              .withArgs(router.address, aliceAdmin.address, rewardPerMember)
              .to.emit(nativeToken, 'Transfer')
              .withArgs(router.address, aliceAdmin.address, 0);

            const afterMemberUpdateTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(afterMemberUpdateTokenFeeData.feesAccrued).to.equal(totalAccrued);
            expect(afterMemberUpdateTokenFeeData.accumulator).to.equal(rewardPerMember);
            expect(afterMemberUpdateTokenFeeData.previousAccrued).to.equal(afterMemberUpdateTokenFeeData.feesAccrued);

            expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(rewardPerMember);
          });

          it('should correctly accrue fees after addition of a new member when different native and token payments exist', async () => {
            // given
            const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

            await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
            await nativeToken.mint(nonMember.address, amount);

            await nativeToken.connect(nonMember).approve(router.address, amount);
            await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);
            const receiver = nonMember.address;

            const encodeData = ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
              [1, chainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await alice.signMessage(hashData);

            // and
            await erc721Portal.setERC721Payment(wrappedERC721.address, paymentToken.address, ERC721BurnFee);
            // and
            await erc721Portal.mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature]);
            // and
            await nativeToken.mint(nonMember.address, amount);
            // and
            await paymentToken.connect(nonMember).approve(router.address, ERC721BurnFee);
            // and
            await wrappedERC721.connect(nonMember).approve(router.address, tokenID);
            // and
            await erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, paymentToken.address, ERC721BurnFee, receiver);
            // and


            const beforeMemberUpdateNativeTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(beforeMemberUpdateNativeTokenFeeData.feesAccrued).to.equal(serviceFee);
            expect(beforeMemberUpdateNativeTokenFeeData.accumulator).to.equal(0);
            expect(beforeMemberUpdateNativeTokenFeeData.previousAccrued).to.equal(0);

            const beforeMemberUpdatePaymentTokenFeeData = await router.tokenFeeData(paymentToken.address);
            expect(beforeMemberUpdatePaymentTokenFeeData.feesAccrued).to.equal(ERC721BurnFee);
            expect(beforeMemberUpdatePaymentTokenFeeData.accumulator).to.equal(0);
            expect(beforeMemberUpdatePaymentTokenFeeData.previousAccrued).to.equal(0);

            // when
            await router.updateMember(bob.address, bobAdmin.address, true);

            // then
            const afterMemberUpdateNativeTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(afterMemberUpdateNativeTokenFeeData.feesAccrued).to.equal(serviceFee);
            expect(afterMemberUpdateNativeTokenFeeData.accumulator).to.equal(serviceFee);
            expect(afterMemberUpdateNativeTokenFeeData.previousAccrued).to.equal(afterMemberUpdateNativeTokenFeeData.feesAccrued);

            expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(0);
            expect(await router.claimedRewardsPerAccount(bob.address, nativeToken.address)).to.equal(serviceFee);
            // and
            const afterMemberUpdatePaymentTokenFeeData = await router.tokenFeeData(paymentToken.address);
            expect(afterMemberUpdatePaymentTokenFeeData.feesAccrued).to.equal(ERC721BurnFee);
            expect(afterMemberUpdatePaymentTokenFeeData.accumulator).to.equal(ERC721BurnFee);
            expect(afterMemberUpdatePaymentTokenFeeData.previousAccrued).to.equal(afterMemberUpdatePaymentTokenFeeData.feesAccrued);

            expect(await router.claimedRewardsPerAccount(alice.address, paymentToken.address)).to.equal(0);
            expect(await router.claimedRewardsPerAccount(bob.address, paymentToken.address)).to.equal(ERC721BurnFee);
          });

          it('should correctly accrue fees after removal of a member when different native and token payments exist', async () => {
            // given
            const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
            const serviceFeeRewardPerMember = serviceFee.div(2);
            const paymentTokenRewardPerMember = ERC721BurnFee.div(2);
            // and
            await router.updateMember(bob.address, bobAdmin.address, true);
            // and
            await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
            await nativeToken.mint(nonMember.address, amount);

            await nativeToken.connect(nonMember).approve(router.address, amount);
            await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);
            const receiver = nonMember.address;

            const encodeData = ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
              [1, chainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver]);
            const hashMsg = ethers.utils.keccak256(encodeData);
            hashData = ethers.utils.arrayify(hashMsg);

            const aliceSignature = await alice.signMessage(hashData);

            // and
            await erc721Portal.setERC721Payment(wrappedERC721.address, paymentToken.address, ERC721BurnFee);
            // and
            await erc721Portal.mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature]);
            // and
            await nativeToken.mint(nonMember.address, amount);
            // and
            await paymentToken.connect(nonMember).approve(router.address, ERC721BurnFee);
            // and
            await wrappedERC721.connect(nonMember).approve(router.address, tokenID);
            // and
            await erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, paymentToken.address, ERC721BurnFee, receiver);

            const beforeMemberUpdateNativeTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(beforeMemberUpdateNativeTokenFeeData.feesAccrued).to.equal(serviceFee);
            expect(beforeMemberUpdateNativeTokenFeeData.accumulator).to.equal(0);
            expect(beforeMemberUpdateNativeTokenFeeData.previousAccrued).to.equal(0);

            const beforeMemberUpdatePaymentTokenFeeData = await router.tokenFeeData(paymentToken.address);
            expect(beforeMemberUpdatePaymentTokenFeeData.feesAccrued).to.equal(ERC721BurnFee);
            expect(beforeMemberUpdatePaymentTokenFeeData.accumulator).to.equal(0);
            expect(beforeMemberUpdatePaymentTokenFeeData.previousAccrued).to.equal(0);

            // when
            await expect(
              router.updateMember(alice.address, aliceAdmin.address, false))
              .to.emit(router, 'MemberUpdated')
              .withArgs(alice.address, false)
              .to.emit(router, 'MemberAdminUpdated')
              .withArgs(alice.address, ethers.constants.AddressZero)
              .to.emit(nativeToken, 'Transfer')
              .withArgs(router.address, aliceAdmin.address, serviceFeeRewardPerMember)
              .to.emit(paymentToken, 'Transfer')
              .withArgs(router.address, aliceAdmin.address, paymentTokenRewardPerMember);

            const afterMemberUpdateNativeTokenFeeData = await router.tokenFeeData(nativeToken.address);
            expect(afterMemberUpdateNativeTokenFeeData.feesAccrued).to.equal(serviceFee);
            expect(afterMemberUpdateNativeTokenFeeData.accumulator).to.equal(serviceFeeRewardPerMember);
            expect(afterMemberUpdateNativeTokenFeeData.previousAccrued).to.equal(afterMemberUpdateNativeTokenFeeData.feesAccrued);
            expect(await router.claimedRewardsPerAccount(alice.address, nativeToken.address)).to.equal(serviceFeeRewardPerMember);

            const afterMemberUpdatePaymentTokenFeeData = await router.tokenFeeData(paymentToken.address);
            expect(afterMemberUpdatePaymentTokenFeeData.feesAccrued).to.equal(ERC721BurnFee);
            expect(afterMemberUpdatePaymentTokenFeeData.accumulator).to.equal(paymentTokenRewardPerMember);
            expect(afterMemberUpdatePaymentTokenFeeData.previousAccrued).to.equal(afterMemberUpdatePaymentTokenFeeData.feesAccrued);

            expect(await router.claimedRewardsPerAccount(alice.address, paymentToken.address)).to.equal(paymentTokenRewardPerMember);
          });
        });
      });
    });

    describe('ERC721PortalFacet', async () => {
      let erc721PortalFacet; // Actual PaymentFacet Contract
      let erc721Portal; // Wrapped Diamond contract to a IPayment

      const wrappedTokenName = 'Wrapped ERC-721 Token';
      const wrappedTokenSymbol = 'WT ERC-721';
      let wrappedERC721;

      beforeEach(async () => {
        const erc721PortalFacetFactory = await ethers.getContractFactory('ERC721PortalFacet');
        erc721PortalFacet = await erc721PortalFacetFactory.deploy();
        await erc721PortalFacet.deployed();

        // Diamond cut to add ERC-721 Portal Facet
        const diamondAddCut = [{
          facetAddress: erc721PortalFacet.address,
          action: 0, // Add
          functionSelectors: getSelectors(erc721PortalFacet),
        }];

        await router.diamondCut(diamondAddCut, ethers.constants.AddressZero, "0x");

        erc721Portal = await ethers.getContractAt('IERC721PortalFacet', diamond.address);

        const wrappedERC721Factory = await ethers.getContractFactory('WrappedERC721');
        wrappedERC721 = await wrappedERC721Factory.deploy(wrappedTokenName, wrappedTokenSymbol);
        await wrappedERC721.deployed();
        await wrappedERC721.transferOwnership(router.address);
      });

      it('should diamond cut successfully', async () => {
        expect(await router.facetAddresses())
          .to.include(routerFacet.address)
          .to.include(pausableFacet.address)
          .to.include(ownershipFacet.address)
          .to.include(feeCalculatorFacet.address)
          .to.include(cutFacet.address)
          .to.include(loupeFacet.address)
          .to.include(paymentFacet.address)
          .to.include(erc721PortalFacet.address);

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
            case pausableFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(pausableFacet));
              break;
            case routerFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(routerFacet));
              break;
            case paymentFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(paymentFacet));
              break;
            case erc721PortalFacet.address:
              expect(facet.functionSelectors).to.deep.equal(getSelectors(erc721PortalFacet));
              break;
            default:
              throw 'invalid facet address'
          }
        }
      });

      describe('setERC721Payment', async () => {
        it('should set ERC-721 payment', async () => {
          // given
          await payment.setPaymentToken(nativeToken.address, true);

          // when
          await erc721Portal.setERC721Payment(wrappedERC721.address, nativeToken.address, ERC721BurnFee);

          // then
          expect(await erc721Portal.erc721Payment(wrappedERC721.address)).to.equal(nativeToken.address);
          expect(await erc721Portal.erc721Fee(wrappedERC721.address)).to.equal(ERC721BurnFee);
        });

        it('should emit event with args', async () => {
          // given
          await payment.setPaymentToken(nativeToken.address, true);

          // when
          await expect(erc721Portal.setERC721Payment(wrappedERC721.address, nativeToken.address, ERC721BurnFee))
            .to.emit(erc721Portal, 'SetERC721Payment')
            .withArgs(wrappedERC721.address, nativeToken.address, ERC721BurnFee);
        });

        it('should revert when caller is not owner', async () => {
          const expectedRevertMessage = 'LibDiamond: Must be contract owner';
          await expect(erc721Portal
            .connect(nonMember)
            .setERC721Payment(wrappedERC721.address, nativeToken.address, ERC721BurnFee)
          ).to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when token payment is not supported', async () => {
          const expectedRevertMessage = 'ERC721PortalFacet: payment token not supported';
          await expect(erc721Portal
            .setERC721Payment(wrappedERC721.address, alice.address, ERC721BurnFee)
          ).to.be.revertedWith(expectedRevertMessage);
        });
      });

      describe('mintERC721', async () => {
        let receiver;
        let hashData;
        let aliceSignature;
        let bobSignature;
        let carolSignature;

        beforeEach(async () => {
          receiver = nonMember.address;
          await router.updateMember(bob.address, bobAdmin.address, true);
          await router.updateMember(carol.address, carolAdmin.address, true);

          const encodeData = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
            [1, chainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver]);
          const hashMsg = ethers.utils.keccak256(encodeData);
          hashData = ethers.utils.arrayify(hashMsg);

          aliceSignature = await alice.signMessage(hashData);
          bobSignature = await bob.signMessage(hashData);
          carolSignature = await carol.signMessage(hashData);
        });

        it('should mint successfully', async () => {
          await erc721Portal.mintERC721(
            1,
            transactionId,
            wrappedERC721.address,
            tokenID,
            metadata,
            receiver,
            [aliceSignature, bobSignature, carolSignature]);

          // then
          const receiverBalance = await wrappedERC721.balanceOf(receiver);
          expect(receiverBalance).to.equal(1);
          expect(await wrappedERC721.tokenOfOwnerByIndex(receiver, 0)).to.equal(tokenID);
          // and
          expect(await wrappedERC721.ownerOf(tokenID)).to.equal(nonMember.address);
          expect(await wrappedERC721.tokenURI(tokenID)).to.equal(metadata);
          // and
          expect(await wrappedERC721.totalSupply()).to.equal(1);
          expect(await wrappedERC721.tokenByIndex(0)).to.equal(tokenID);
          // and
          expect(await router.hashesUsed(ethers.utils.hashMessage(hashData))).to.be.true;
        });

        it('should emit event with args', async () => {
          const sourceChainId = 1;
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              sourceChainId,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature, bobSignature, carolSignature]))
            .to.emit(erc721Portal, 'MintERC721')
            .withArgs(sourceChainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver)
            .to.emit(wrappedERC721, 'Transfer')
            .withArgs(ethers.constants.AddressZero, receiver, tokenID);
        });

        it('should revert when trying to mint for the same transaction', async () => {
          const expectedRevertMessage = 'ERC721PortalFacet: transaction already submitted';
          await erc721Portal.connect(nonMember).mintERC721(
            1,
            transactionId,
            wrappedERC721.address,
            tokenID,
            metadata,
            receiver,
            [aliceSignature, bobSignature, carolSignature]);

          await expect(erc721Portal.connect(nonMember).mintERC721(
            1,
            transactionId,
            wrappedERC721.address,
            tokenID,
            metadata,
            receiver,
            [aliceSignature, bobSignature, carolSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert with insufficient signatures', async () => {
          const expectedRevertMessage = 'LibGovernance: Invalid number of signatures';
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert with a non-member signature', async () => {
          const expectedRevertMessage = 'LibGovernance: invalid signer';
          const nonMemberSignature = await nonMember.signMessage(hashData);

          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature, nonMemberSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert with duplicate signatures', async () => {
          const expectedRevertMessage = 'LibGovernance: duplicate signatures';
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature, aliceSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert with mismatching data and signatures', async () => {
          const expectedRevertMessage = 'LibGovernance: invalid signer';
          // when
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              145,
              metadata,
              receiver,
              [aliceSignature, aliceSignature]))
            .to.be.revertedWith(expectedRevertMessage);
          // and
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              'hello',
              receiver,
              [aliceSignature, aliceSignature]))
            .to.be.revertedWith(expectedRevertMessage);
          // and
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              alice.address,
              [aliceSignature, aliceSignature]))
            .to.be.revertedWith(expectedRevertMessage);
          // and
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              ethers.utils.toUtf8Bytes('adfff'),
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature, aliceSignature]))
            .to.be.revertedWith(expectedRevertMessage);
          // and
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              5,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature, aliceSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when contract is paused', async () => {
          // given
          const expectedRevertMessage = 'LibGovernance: paused';
          await router.updateAdmin(admin.address);
          await router.connect(admin).pause();

          // then
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature, bobSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when router cannot mint', async () => {
          // given
          const wrappedERC721Factory = await ethers.getContractFactory('WrappedERC721');
          wrappedERC721 = await wrappedERC721Factory.deploy('Not transferred ownership', 'NTO');
          await wrappedERC721.deployed();
          // and
          const encodeData = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
            [1, chainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver]);
          const hashMsg = ethers.utils.keccak256(encodeData);
          hashData = ethers.utils.arrayify(hashMsg);
          // and
          aliceSignature = await alice.signMessage(hashData);
          bobSignature = await bob.signMessage(hashData);
          carolSignature = await carol.signMessage(hashData);
          // and
          const expectedRevertMessage = 'Ownable: caller is not the owner';
          // then
          await expect(erc721Portal
            .connect(nonMember)
            .mintERC721(
              1,
              transactionId,
              wrappedERC721.address,
              tokenID,
              metadata,
              receiver,
              [aliceSignature, bobSignature]))
            .to.be.revertedWith(expectedRevertMessage);
        });
      });

      describe('burnERC721', async () => {
        beforeEach(async () => {
          receiver = nonMember.address;

          const encodeData = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes', 'address', 'uint256', 'string', 'address'],
            [1, chainId, transactionId, wrappedERC721.address, tokenID, metadata, receiver]);
          const hashMsg = ethers.utils.keccak256(encodeData);
          hashData = ethers.utils.arrayify(hashMsg);

          const aliceSignature = await alice.signMessage(hashData);

          // given
          await payment.setPaymentToken(nativeToken.address, true);
          await erc721Portal.setERC721Payment(wrappedERC721.address, nativeToken.address, ERC721BurnFee);
          // and
          await erc721Portal.mintERC721(
            1,
            transactionId,
            wrappedERC721.address,
            tokenID,
            metadata,
            receiver,
            [aliceSignature]);
          // and
          await nativeToken.mint(nonMember.address, amount);
        });

        it('should burn successfully', async () => {
          await nativeToken.connect(nonMember).approve(router.address, ERC721BurnFee);
          // and
          await wrappedERC721.connect(nonMember).approve(router.address, tokenID);

          // when
          await erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver);

          // then
          const balance = await wrappedERC721.balanceOf(nonMember.address);
          expect(balance).to.equal(0);
          await expect(wrappedERC721.tokenOfOwnerByIndex(receiver, 0)).to.be.revertedWith('ERC721Enumerable: owner index out of bounds');
          // and
          await expect(wrappedERC721.ownerOf(tokenID)).to.be.revertedWith('ERC721: owner query for nonexistent token');
          await expect(wrappedERC721.tokenURI(tokenID)).to.be.revertedWith('WrappedERC721: URI query for nonexistent token');
          // and
          await expect(wrappedERC721.tokenByIndex(0)).to.be.revertedWith('ERC721Enumerable: global index out of bounds');
          expect(await wrappedERC721.totalSupply()).to.equal(0);
          // and
          const tokenFeeData = await router.tokenFeeData(nativeToken.address);
          expect(tokenFeeData.feesAccrued).to.equal(ERC721BurnFee);
          expect(tokenFeeData.accumulator).to.equal(0);
          expect(tokenFeeData.previousAccrued).to.equal(0);
        });

        it('should emit event with args', async () => {
          await nativeToken.connect(nonMember).approve(router.address, ERC721BurnFee);
          // and
          await wrappedERC721.connect(nonMember).approve(router.address, tokenID);

          // when
          expect(
            await erc721Portal
              .connect(nonMember)
              .burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver)
          )
            .to.emit(erc721Portal, 'BurnERC721')
            .withArgs(1, wrappedERC721.address, tokenID, receiver.toLowerCase(), nativeToken.address, ERC721BurnFee)
            .to.emit(wrappedERC721, 'Transfer')
            .withArgs(nonMember.address, ethers.constants.AddressZero, tokenID);
        });

        it('should revert with no approved ERC-721 token', async () => {
          // given
          await nativeToken.connect(nonMember).approve(router.address, ERC721BurnFee);
          // then
          const expectedRevertMessage = 'ERC721Burnable: caller is not owner nor approved';
          await expect(erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when no approved ERC-20 payments', async () => {
          const expectedRevertMessage = 'ERC20: transfer amount exceeds allowance';
          await expect(erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert burn when contract is paused', async () => {
          // given
          const expectedRevertMessage = 'LibGovernance: paused';
          await router.updateAdmin(admin.address);
          await router.connect(admin).pause();
          // then
          await expect(erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when payment token is not supported', async () => {
          // given
          await payment.setPaymentToken(nativeToken.address, false);
          // then
          const expectedRevertMessage = 'ERC721PortalFacet: payment token not supported';
          await expect(erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee, receiver))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when provided burn fee is does not match expected burn fee', async () => {
          // then
          const expectedRevertMessage = 'ERC721PortalFacet: _fee does not match current set payment token fee';
          await expect(erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nativeToken.address, ERC721BurnFee.mul(2), receiver))
            .to.be.revertedWith(expectedRevertMessage);
        });

        it('should revert when provided burn payment token does not match current set payment token', async () => {
          const expectedRevertMessage = 'ERC721PortalFacet: _paymentToken does not match the current set payment token';
          await expect(erc721Portal.connect(nonMember).burnERC721(1, wrappedERC721.address, tokenID, nonMember.address, ERC721BurnFee, receiver))
            .to.be.revertedWith(expectedRevertMessage);
        });
      });
    });
  });

  describe('FeePolicyFacet', async () => {
    let feePolicyPortal;
    let testNativeToken1;
    let testNativeToken2;
    let testNativeToken3;
    const revertMessageOwnable = 'Ownable: caller is not the owner';
    const revertMessageNotDiamondOwner = 'LibDiamond: Must be contract owner';
    const revertMessageZeroFeePolicyAddress = 'FeeCalculatorFacet: _feePolicyAddress must not be 0x0';
    const revertMessageZeroUserAddress = 'FeeCalculatorFacet: userAddress must not be 0x0';

    beforeEach(async () => {
      const testNativeTokenFactory = await ethers.getContractFactory('Token');

      testNativeToken1 = await testNativeTokenFactory.deploy('NativeToken1', 'NT1', 18);
      await testNativeToken1.deployed();

      testNativeToken2 = await testNativeTokenFactory.deploy('NativeToken2', 'NT2', 18);
      await testNativeToken2.deployed();

      testNativeToken3 = await testNativeTokenFactory.deploy('NativeToken3', 'NT2', 18);
      await testNativeToken3.deployed();

      const FeePolicyFacetFactory = await ethers.getContractFactory('FeePolicyFacet');
      feePolicyFacet = await FeePolicyFacetFactory.deploy();
      await feePolicyFacet.deployed();

      const diamondCut = [
        { facetAddress: feePolicyFacet.address, action: enumFacetCutAction.Add, functionSelectors: getSelectors(feePolicyFacet) }
      ];

      await router.diamondCut(diamondCut, ethers.constants.AddressZero, "0x");

      feePolicyPortal = await ethers.getContractAt('IFeePolicyFacet', router.address);
    });

    it('should diamond cut successfully', async () => {
      expect(await router.facetAddresses())
        .to.include(routerFacet.address)
        .to.include(pausableFacet.address)
        .to.include(ownershipFacet.address)
        .to.include(feeCalculatorFacet.address)
        .to.include(cutFacet.address)
        .to.include(loupeFacet.address)
        .to.include(feePolicyFacet.address);

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
          case pausableFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(pausableFacet));
            break;
          case routerFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(routerFacet));
            break;
          case feePolicyFacet.address:
            expect(facet.functionSelectors).to.deep.equal(getSelectors(feePolicyFacet));
            break;
          default:
            throw 'invalid facet address';
        }
      }
    });

    describe('FlatFeePolicy', async () => {
      let instanceFlatFeePolicy;
      const initFlatFee = 100;

      beforeEach(async () => {
        const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');

        instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(initFlatFee);
        await instanceFlatFeePolicy.deployed();
      });

      describe('deployment', async () => {
        it('should set flat fee on deployment', async () => {
          const flatFee = await instanceFlatFeePolicy.getFlatFee();
          expect(flatFee).to.equal(initFlatFee);
        });
      });

      describe('getFlatFee', async () => {
        it('shoult get flat fee', async () => {
          const flatFee = await instanceFlatFeePolicy.getFlatFee();
          expect(flatFee).to.equal(initFlatFee);
        });

        it('shoult get flat fee after update', async () => {
          await instanceFlatFeePolicy.setFlatFee(20);
          const flatFee = await instanceFlatFeePolicy.getFlatFee();
          expect(flatFee).to.equal(20);
        });
      });

      describe('setFlatFee', async () => {
        it('should revert when executing with not owner', async () => {
          await expect(instanceFlatFeePolicy.connect(nonMember).setFlatFee(200)).to.be.revertedWith(revertMessageOwnable);
        });

        it('should revert when executing with wrong flat fee value', async () => {
          const revertMessage = 'Value of _flatFee is zero';
          await expect(instanceFlatFeePolicy.setFlatFee(0)).to.be.revertedWith(revertMessage);
        });

        it('should set flat fee value', async () => {
          await instanceFlatFeePolicy.setFlatFee(20);
          const flatFee = await instanceFlatFeePolicy.getFlatFee();
          expect(flatFee).to.equal(20);
        });
      });

      describe('feeAmountFor', async () => {
        it('should return flat fee and exists', async () => {
          const { feeAmount, exist } = await instanceFlatFeePolicy.feeAmountFor(0, ethers.constants.AddressZero, ethers.constants.AddressZero, 0);
          expect(feeAmount).to.equal(initFlatFee);
          expect(exist).to.equal(true);
        });

        it('should return flat fee and exists after update', async () => {
          await instanceFlatFeePolicy.setFlatFee(200);
          const { feeAmount, exist } = await instanceFlatFeePolicy.feeAmountFor(0, ethers.constants.AddressZero, ethers.constants.AddressZero, 0);
          expect(feeAmount).to.equal(200);
          expect(exist).to.equal(true);
        });
      });
    });

    describe('PercentageFeePolicy', async () => {
      let instancePercentageFeePolicy;
      const initPrecision = 100_000;
      const initFeePercentage = 1_000;

      beforeEach(async () => {
        const testPercentageFeePolicyFactory = await ethers.getContractFactory('PercentageFeePolicy');

        instancePercentageFeePolicy = await testPercentageFeePolicyFactory.deploy(initPrecision, initFeePercentage);
        await instancePercentageFeePolicy.deployed();
      });

      describe('deployment', async () => {
        it('should set precision on deployment', async () => {
          const precision = await instancePercentageFeePolicy.getPrecision();
          expect(precision).to.equal(initPrecision);
        });

        it('should set fee percentage on deployment', async () => {
          const feePercentage = await instancePercentageFeePolicy.getFeePercentage();
          expect(feePercentage).to.equal(initFeePercentage);
        });
      });

      describe('getPrecision', async () => {
        it('shoult get precision', async () => {
          const precision = await instancePercentageFeePolicy.getPrecision();
          expect(precision).to.equal(initPrecision);
        });

        it('shoult get precision after update', async () => {
          await instancePercentageFeePolicy.setPrecision(1_000_000);
          const precision = await instancePercentageFeePolicy.getPrecision();
          expect(precision).to.equal(1_000_000);
        });
      });

      describe('setPrecision', async () => {
        it('should revert when executing with not owner', async () => {
          await expect(instancePercentageFeePolicy.connect(nonMember).setPrecision(1_000_000)).to.be.revertedWith(revertMessageOwnable);
        });

        it('should revert when executing with wrong flat fee value', async () => {
          const revertMessage = 'Value of _precision is zero';
          await expect(instancePercentageFeePolicy.setPrecision(0)).to.be.revertedWith(revertMessage);
        });

        it('should set flat fee value', async () => {
          await instancePercentageFeePolicy.setPrecision(20);
          const flatFee = await instancePercentageFeePolicy.getPrecision();
          expect(flatFee).to.equal(20);
        });
      });

      describe('getFeePercentage', async () => {
        it('shoult get fee percentage', async () => {
          const feePercentage = await instancePercentageFeePolicy.getFeePercentage();
          expect(feePercentage).to.equal(initFeePercentage);
        });

        it('shoult get fee percentage after update', async () => {
          await instancePercentageFeePolicy.setFeePercentage(20);
          const feePercentage = await instancePercentageFeePolicy.getFeePercentage();
          expect(feePercentage).to.equal(20);
        });
      });

      describe('setFeePercentage', async () => {
        it('should revert when executing with not owner', async () => {
          await expect(instancePercentageFeePolicy.connect(nonMember).setFeePercentage(200)).to.be.revertedWith(revertMessageOwnable);
        });

        it('should revert when executing with wrong flat fee value', async () => {
          const revertMessage = 'Value of _feePercentage is zero';
          await expect(instancePercentageFeePolicy.setFeePercentage(0)).to.be.revertedWith(revertMessage);
        });

        it('should set fee percentage value', async () => {
          await instancePercentageFeePolicy.setFeePercentage(20);
          const flatFeePercentage = await instancePercentageFeePolicy.getFeePercentage();
          expect(flatFeePercentage).to.equal(20);
        });
      });

      describe('feeAmountFor', async () => {
        it('should return flat fee and exists', async () => {
          const _testAmount = ethers.utils.parseEther('100');
          const valueToCompare = _testAmount.mul(initFeePercentage).div(initPrecision);

          const { feeAmount, exist } = await instancePercentageFeePolicy.feeAmountFor(0, ethers.constants.AddressZero, ethers.constants.AddressZero, _testAmount);
          expect(feeAmount).to.equal(valueToCompare);
          expect(exist).to.equal(true);
        });

        it('should return flat fee and exists after update', async () => {
          const _testAmount = ethers.utils.parseEther('100');
          const _testNewFeePercentage = 2_000;
          const valueToCompare = _testAmount.mul(_testNewFeePercentage).div(initPrecision);

          await instancePercentageFeePolicy.setFeePercentage(_testNewFeePercentage);
          const { feeAmount, exist } = await instancePercentageFeePolicy.feeAmountFor(0, ethers.constants.AddressZero, ethers.constants.AddressZero, _testAmount);
          expect(feeAmount).to.equal(valueToCompare);
          expect(exist).to.equal(true);
        });
      });
    });

    describe('FlatFeePerTokenPolicy', async () => {
      let instanceFlatFeePerTokenPolicy;
      const initFlatFee = 10;

      beforeEach(async () => {
        const testFlatFeePerTokenPolicyFactory = await ethers.getContractFactory('FlatFeePerTokenPolicy');

        instanceFlatFeePerTokenPolicy = await testFlatFeePerTokenPolicyFactory.deploy();
        await instanceFlatFeePerTokenPolicy.deployed();

        await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePerTokenPolicy.address, [feePolicyUser_1.address, feePolicyUser_2.address]);
      });

      describe('getFlatFee', async () => {
        beforeEach(async () => {
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, initFlatFee);
        });

        it('shoult get flat fee', async () => {
          const flatFee = await instanceFlatFeePerTokenPolicy.getFlatFee(testNativeToken1.address);
          expect(flatFee).to.equal(initFlatFee);
        });

        it('shoult get flat fee after update', async () => {
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, 20);
          const flatFee = await instanceFlatFeePerTokenPolicy.getFlatFee(testNativeToken1.address);
          expect(flatFee).to.equal(20);
        });

        it('shoult get flat fee zero for non existing token', async () => {
          const flatFee = await instanceFlatFeePerTokenPolicy.getFlatFee(testNativeToken2.address);
          expect(flatFee).to.equal(0);
        });
      });

      describe('setFlatFee', async () => {
        beforeEach(async () => {
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, initFlatFee);
        });

        it('should revert when executing with not owner', async () => {
          await expect(instanceFlatFeePerTokenPolicy.connect(nonMember).setFlatFee(testNativeToken1.address, 20)).to.be.revertedWith(revertMessageOwnable);
        });

        it('should revert when executing with token address zero', async () => {
          const revertMessage = 'Token address must not be 0x0';
          await expect(instanceFlatFeePerTokenPolicy.setFlatFee(ethers.constants.AddressZero, 20)).to.be.revertedWith(revertMessage);
        });

        it('should not revert when executing with flat fee value zero', async () => {
          await expect(instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, 0)).to.not.be.reverted;
        });

        it('should set flat fee value', async () => {
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, 20);
          const flatFee = await instanceFlatFeePerTokenPolicy.getFlatFee(testNativeToken1.address);
          expect(flatFee).to.equal(20);
        });
      });

      describe('removeFlatFee', async () => {
        beforeEach(async () => {
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, initFlatFee);
        });

        it('should revert when executing with not owner', async () => {
          await expect(instanceFlatFeePerTokenPolicy.connect(nonMember).removeFlatFee(testNativeToken1.address)).to.be.revertedWith(revertMessageOwnable);
        });

        it('should revert when executing with token address zero', async () => {
          const revertMessage = 'Token address must not be 0x0';
          await expect(instanceFlatFeePerTokenPolicy.removeFlatFee(ethers.constants.AddressZero)).to.be.revertedWith(revertMessage);
        });

        it('should remove flat fee value', async () => {
          await instanceFlatFeePerTokenPolicy.removeFlatFee(testNativeToken1.address);
          const { feeAmount, exist } = await instanceFlatFeePerTokenPolicy.feeAmountFor(0, ethers.constants.AddressZero, testNativeToken1.address, 0);
          expect(feeAmount).to.equal(0);
          expect(exist).to.equal(false);
        });
      });

      describe('feeAmountFor', async () => {
        beforeEach(async () => {
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, initFlatFee);
        });

        it('should return flat fee and exists', async () => {
          const { feeAmount, exist } = await instanceFlatFeePerTokenPolicy.feeAmountFor(0, ethers.constants.AddressZero, testNativeToken1.address, 0);
          expect(feeAmount).to.equal(initFlatFee);
          expect(exist).to.equal(true);
        });

        it('should return flat fee and exists after update', async () => {
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, 200);
          const { feeAmount, exist } = await instanceFlatFeePerTokenPolicy.feeAmountFor(0, ethers.constants.AddressZero, testNativeToken1.address, 0);
          expect(feeAmount).to.equal(200);
          expect(exist).to.equal(true);
        });

        it('should return zero flat fee and not exists', async () => {
          const { feeAmount, exist } = await instanceFlatFeePerTokenPolicy.feeAmountFor(0, ethers.constants.AddressZero, testNativeToken2.address, 0);
          expect(feeAmount).to.equal(0);
          expect(exist).to.equal(false);
        });
      });
    });

    describe('setUsersFeePolicy', async () => {
      let instanceFlatFeePolicy;

      beforeEach(async () => {
        const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');

        instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(100);
        await instanceFlatFeePolicy.deployed();

        await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address, feePolicyUser_2.address]);
      });

      it('should revert when executing with not router', async () => {
        await expect(feePolicyPortal.connect(nonMember).setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_2.address])).to.be.revertedWith(revertMessageNotDiamondOwner);
      });

      it('should revert when executing with zero fee policy address', async () => {
        await expect(feePolicyPortal.setUsersFeePolicy('0x0000000000000000000000000000000000000000', [feePolicyUser_2.address])).to.be.revertedWith(revertMessageZeroFeePolicyAddress);
      });

      it('should revert when executing with zero user address', async () => {
        await expect(feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, ['0x0000000000000000000000000000000000000000'])).to.be.revertedWith(revertMessageZeroUserAddress);
        await expect(feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, ['0x0000000000000000000000000000000000000000', feePolicyUser_2.address])).to.be.revertedWith(revertMessageZeroUserAddress);
      });

      it('should add users to fee policy', async () => {
        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_1.address)).to.equal(instanceFlatFeePolicy.address);
        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_2.address)).to.equal(instanceFlatFeePolicy.address);
        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_3.address)).to.equal('0x0000000000000000000000000000000000000000');
      });
    });

    describe('removeUsersFeePolicy', async () => {
      let instanceFlatFeePolicy;

      beforeEach(async () => {
        const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');

        instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(100);
        await instanceFlatFeePolicy.deployed();

        await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address, feePolicyUser_2.address]);
      });

      it('should revert when executing with not router', async () => {
        await expect(feePolicyPortal.connect(nonMember).removeUsersFeePolicy([feePolicyUser_2.address])).to.be.revertedWith(revertMessageNotDiamondOwner);
      });

      it('should revert when executing with zero user address', async () => {
        await expect(feePolicyPortal.removeUsersFeePolicy(['0x0000000000000000000000000000000000000000'])).to.be.revertedWith(revertMessageZeroUserAddress);
        await expect(feePolicyPortal.removeUsersFeePolicy(['0x0000000000000000000000000000000000000000', feePolicyUser_2.address])).to.be.revertedWith(revertMessageZeroUserAddress);
      });

      it('should remove users from fee policy', async () => {
        await feePolicyPortal.removeUsersFeePolicy([feePolicyUser_3.address]);

        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_1.address)).to.equal(instanceFlatFeePolicy.address);
        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_2.address)).to.equal(instanceFlatFeePolicy.address);
        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_3.address)).to.equal('0x0000000000000000000000000000000000000000');
      });
    });

    describe('getUsersFeePolicyAddress', async () => {
      let instanceFlatFeePolicy;

      beforeEach(async () => {
        const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');

        instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(100);
        await instanceFlatFeePolicy.deployed();

        await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address, feePolicyUser_2.address]);
      });

      it('should return existing address for added user', async () => {
        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_1.address)).to.equal(instanceFlatFeePolicy.address);
      });

      it('should return zero address for missing user', async () => {
        expect(await feePolicyPortal.getUsersFeePolicyAddress(feePolicyUser_3.address)).to.equal('0x0000000000000000000000000000000000000000');
      });
    });

    describe('feeAmountFor', async () => {
      let instanceFlatFeePolicy;
      const initFlatFee = 2;

      let instancePercentageFeePolicy;
      const initPrecision = 100_000;
      const initFeePercentage = 1_000;

      let instanceFlatFeePerTokenPolicy;
      const initFlatFeePerToken = 3;

      let serviceFee;

      beforeEach(async () => {
        const testNativeTokenFactory = await ethers.getContractFactory('Token');

        testNativeToken1 = await testNativeTokenFactory.deploy('NativeToken1', 'NT1', 18);
        await testNativeToken1.deployed();

        testNativeToken2 = await testNativeTokenFactory.deploy('NativeToken2', 'NT2', 18);
        await testNativeToken2.deployed();

        serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
        await router.updateNativeToken(testNativeToken1.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);

        // FlatFeePolicy
        const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');
        instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(initFlatFee);
        await instanceFlatFeePolicy.deployed();
        await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address]);

        // PercentageFeePolicy
        const testPercentageFeePolicyFactory = await ethers.getContractFactory('PercentageFeePolicy');
        instancePercentageFeePolicy = await testPercentageFeePolicyFactory.deploy(initPrecision, initFeePercentage);
        await instancePercentageFeePolicy.deployed();
        await feePolicyPortal.setUsersFeePolicy(instancePercentageFeePolicy.address, [feePolicyUser_2.address]);

        // FlatFeePerTokenPolicy
        const testFlatFeePerTokenPolicyFactory = await ethers.getContractFactory('FlatFeePerTokenPolicy');
        instanceFlatFeePerTokenPolicy = await testFlatFeePerTokenPolicyFactory.deploy();
        await instanceFlatFeePerTokenPolicy.deployed();
        await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, initFlatFeePerToken);
        await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePerTokenPolicy.address, [feePolicyUser_3.address]);
      });

      it('should return zero for non existing token', async() => {
        const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_4.address, testNativeToken2.address, amount);
        expect(feeAmountFor).to.equal(0);
      });

      it('should return standard fee', async () => {
        await testNativeToken1.mint(feePolicyUser_4.address, amount);
        await testNativeToken1.connect(feePolicyUser_4).approve(router.address, amount);

        const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_4.address, testNativeToken1.address, amount);
        expect(feeAmountFor).to.equal(serviceFee);
      });

      it('shoult return flat fee policy', async () => {
        await testNativeToken1.mint(feePolicyUser_1.address, amount);
        await testNativeToken1.connect(feePolicyUser_1).approve(router.address, amount);

        const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_1.address, testNativeToken1.address, amount);
        expect(feeAmountFor).to.equal(initFlatFee);
      });

      it('should return percentage fee policy', async () => {
        await testNativeToken1.mint(feePolicyUser_2.address, amount);
        await testNativeToken1.connect(feePolicyUser_2).approve(router.address, amount);

        const testFee = amount.mul(initFeePercentage).div(initPrecision);
        const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_2.address, testNativeToken1.address, amount);
        expect(feeAmountFor).to.equal(testFee);
      });

      it('should return fee per token policy', async () => {
        await testNativeToken1.mint(feePolicyUser_3.address, amount);
        await testNativeToken1.connect(feePolicyUser_3).approve(router.address, amount);

        const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_3.address, testNativeToken1.address, amount);
        expect(feeAmountFor).to.equal(initFlatFeePerToken);
      })
    });

    describe('Fee policy rewards', async () => {
      let testNativeToken1;
      let testNativeToken2;
      let testNativeToken3;

      beforeEach(async () => {
        const testNativeTokenFactory = await ethers.getContractFactory('Token');

        testNativeToken1 = await testNativeTokenFactory.deploy('NativeToken1', 'NT1', 18);
        await testNativeToken1.deployed();

        testNativeToken2 = await testNativeTokenFactory.deploy('NativeToken2', 'NT2', 18);
        await testNativeToken2.deployed();

        testNativeToken3 = await testNativeTokenFactory.deploy('NativeToken3', 'NT2', 18);
        await testNativeToken3.deployed();

        await router.updateNativeToken(testNativeToken1.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      });

      describe('Rewards with FlatFeePolicy', async () => {
        let instanceFlatFeePolicy;
        const initFlatFee = 2;

        beforeEach(async () => {
          const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');

          instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(initFlatFee);
          await instanceFlatFeePolicy.deployed();

          await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address]);
        });

        it('should calculate reward with fee policy', async () => {
          const _amount = ethers.utils.parseEther('100');

          await testNativeToken1.mint(feePolicyUser_1.address, _amount);
          await testNativeToken1.connect(feePolicyUser_1).approve(router.address, _amount);

          const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_1.address, testNativeToken1.address, _amount);

          await router.connect(feePolicyUser_1).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(initFlatFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });

        it('should calculate reward with service fee', async () => {
          const _amount = ethers.utils.parseEther('100');

          const serviceFee = _amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

          await testNativeToken1.mint(feePolicyUser_2.address, _amount);

          await testNativeToken1.connect(feePolicyUser_2).approve(router.address, _amount);
          await router.connect(feePolicyUser_2).lock(1, testNativeToken1.address, _amount, owner.address, serviceFee);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });
      });

      describe('Rewards with PercentageFeePolicy', async () => {
        let instancePercentageFeePolicy;
        const initPrecision = 100_000;
        const initFeePercentage = 1_000;

        beforeEach(async () => {
          const testPercentageFeePolicyFactory = await ethers.getContractFactory('PercentageFeePolicy');

          instancePercentageFeePolicy = await testPercentageFeePolicyFactory.deploy(initPrecision, initFeePercentage);
          await instancePercentageFeePolicy.deployed();

          await feePolicyPortal.setUsersFeePolicy(instancePercentageFeePolicy.address, [feePolicyUser_1.address]);
        });

        it('should calculate reward with fee policy', async () => {
          const _amount = ethers.utils.parseEther('100');

          const serviceFee = _amount.mul(initFeePercentage).div(initPrecision);

          await testNativeToken1.mint(feePolicyUser_1.address, _amount);
          await testNativeToken1.connect(feePolicyUser_1).approve(router.address, _amount);

          const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_1.address, testNativeToken1.address, _amount);

          await router.connect(feePolicyUser_1).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });

        it('should calculate reward with service fee', async () => {
          const _amount = ethers.utils.parseEther('100');

          const serviceFee = _amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

          await testNativeToken1.mint(feePolicyUser_2.address, _amount);

          await testNativeToken1.connect(feePolicyUser_2).approve(router.address, _amount);
          await router.connect(feePolicyUser_2).lock(1, testNativeToken1.address, _amount, owner.address, serviceFee);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });
      });

      describe('Rewards with FlatFeePerTokenPolicy', async () => {
        let instanceFlatFeePerTokenPolicy;
        const initFlatFee = 2;

        beforeEach(async () => {
          const testFlatFeePerTokenPolicyFactory = await ethers.getContractFactory('FlatFeePerTokenPolicy');

          instanceFlatFeePerTokenPolicy = await testFlatFeePerTokenPolicyFactory.deploy();
          await instanceFlatFeePerTokenPolicy.deployed();

          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, initFlatFee);

          await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePerTokenPolicy.address, [feePolicyUser_1.address]);
        });

        it('should calculate reward with fee policy', async () => {
          const _amount = ethers.utils.parseEther('100');

          await testNativeToken1.mint(feePolicyUser_1.address, _amount);
          await testNativeToken1.connect(feePolicyUser_1).approve(router.address, _amount);

          const feeAmountFor = await router.feeAmountFor(1, feePolicyUser_1.address, testNativeToken1.address, _amount);

          await router.connect(feePolicyUser_1).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(initFlatFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });

        it('should calculate reward with service fee', async () => {
          const _amount = ethers.utils.parseEther('100');

          const serviceFee = _amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

          await testNativeToken1.mint(feePolicyUser_2.address, _amount);

          await testNativeToken1.connect(feePolicyUser_2).approve(router.address, _amount);
          await router.connect(feePolicyUser_2).lock(1, testNativeToken1.address, _amount, owner.address, serviceFee);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);
          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(serviceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });
      });

      describe('Rewards with FlatFeePolicy & PercentageFeePolicy', async () => {
        let instanceFlatFeePolicy;
        const initFlatFee = 2;

        let instancePercentageFeePolicy;
        const initPrecision = 100_000;
        const initFeePercentage = 1_000;

        beforeEach(async () => {
          // FlatFeePolicy
          const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');

          instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(initFlatFee);
          await instanceFlatFeePolicy.deployed();

          await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address]);

          // PercentageFeePolicy
          const testPercentageFeePolicyFactory = await ethers.getContractFactory('PercentageFeePolicy');

          instancePercentageFeePolicy = await testPercentageFeePolicyFactory.deploy(initPrecision, initFeePercentage);
          await instancePercentageFeePolicy.deployed();

          // Set two users with different policies
          await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address]);
          await feePolicyPortal.setUsersFeePolicy(instancePercentageFeePolicy.address, [feePolicyUser_2.address]);
        });

        it('should calculate accumulated fees via FlatFeePolicy plus PercentageFeePolicy plus ServiceFee', async () => {
          const _amount = ethers.utils.parseEther('100');

          // via feePolicyUser_1 with FlatFeePolicy
          await testNativeToken1.mint(feePolicyUser_1.address, _amount);
          await testNativeToken1.connect(feePolicyUser_1).approve(router.address, _amount);
          const feeAmountFor1 = await router.feeAmountFor(1, feePolicyUser_1.address, testNativeToken1.address, _amount);
          await router.connect(feePolicyUser_1).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor1);

          // via feePolicyUser_2 with PercentageFeePolicy
          await testNativeToken1.mint(feePolicyUser_2.address, _amount);
          await testNativeToken1.connect(feePolicyUser_2).approve(router.address, _amount);
          const feeAmountFor2 = await router.feeAmountFor(1, feePolicyUser_2.address, testNativeToken1.address, _amount);
          await router.connect(feePolicyUser_2).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor2);

          // via feePolicyUser_3 with FEE_CALCULATOR_TOKEN_SERVICE_FEE
          await testNativeToken1.mint(feePolicyUser_3.address, _amount);
          await testNativeToken1.connect(feePolicyUser_3).approve(router.address, _amount);
          const feeAmountFor3 = await router.feeAmountFor(1, feePolicyUser_3.address, testNativeToken1.address, _amount);
          await router.connect(feePolicyUser_3).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor3);

          // service fee
          const serviceFee1 = initFlatFee;
          const serviceFe2 = _amount.mul(initFeePercentage).div(initPrecision);
          const serviceFe3 = _amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

          const allServiceFee = serviceFe3.add(serviceFe2).add(serviceFee1);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);

          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(allServiceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });
      });

      describe('Rewards with FlatFeePolicy & PercentageFeePolicy & FlatFeePerTokenPolicy', async () => {
        let instanceFlatFeePolicy;
        const initFlatFee = 2;

        let instancePercentageFeePolicy;
        const initPrecision = 100_000;
        const initFeePercentage = 1_000;

        let instanceFlatFeePerTokenPolicy;
        const initFlatFeePerToken = 3;

        beforeEach(async () => {
          // FlatFeePolicy
          const testFlatFeePolicyFactory = await ethers.getContractFactory('FlatFeePolicy');
          instanceFlatFeePolicy = await testFlatFeePolicyFactory.deploy(initFlatFee);
          await instanceFlatFeePolicy.deployed();
          await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePolicy.address, [feePolicyUser_1.address]);

          // PercentageFeePolicy
          const testPercentageFeePolicyFactory = await ethers.getContractFactory('PercentageFeePolicy');
          instancePercentageFeePolicy = await testPercentageFeePolicyFactory.deploy(initPrecision, initFeePercentage);
          await instancePercentageFeePolicy.deployed();
          await feePolicyPortal.setUsersFeePolicy(instancePercentageFeePolicy.address, [feePolicyUser_2.address]);

          // FlatFeePerTokenPolicy
          const testFlatFeePerTokenPolicyFactory = await ethers.getContractFactory('FlatFeePerTokenPolicy');
          instanceFlatFeePerTokenPolicy = await testFlatFeePerTokenPolicyFactory.deploy();
          await instanceFlatFeePerTokenPolicy.deployed();
          await instanceFlatFeePerTokenPolicy.setFlatFee(testNativeToken1.address, initFlatFeePerToken);
          await feePolicyPortal.setUsersFeePolicy(instanceFlatFeePerTokenPolicy.address, [feePolicyUser_3.address]);
        });

        it('should calculate accumulated fees via FlatFeePolicy plus PercentageFeePolicy plus ServiceFee', async () => {
          const _amount = ethers.utils.parseEther('100');

          // via feePolicyUser_1 with FlatFeePolicy
          await testNativeToken1.mint(feePolicyUser_1.address, _amount);
          await testNativeToken1.connect(feePolicyUser_1).approve(router.address, _amount);
          const feeAmountFor1 = await router.feeAmountFor(1, feePolicyUser_1.address, testNativeToken1.address, _amount);
          await router.connect(feePolicyUser_1).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor1);

          // via feePolicyUser_2 with PercentageFeePolicy
          await testNativeToken1.mint(feePolicyUser_2.address, _amount);
          await testNativeToken1.connect(feePolicyUser_2).approve(router.address, _amount);
          const feeAmountFor2 = await router.feeAmountFor(1, feePolicyUser_2.address, testNativeToken1.address, _amount);
          await router.connect(feePolicyUser_2).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor2);

          // via feePolicyUser_3 with FlatFeePerTokenPolicy
          await testNativeToken1.mint(feePolicyUser_3.address, _amount);
          await testNativeToken1.connect(feePolicyUser_3).approve(router.address, _amount);
          const feeAmountFor3 = await router.feeAmountFor(1, feePolicyUser_3.address, testNativeToken1.address, _amount);
          await router.connect(feePolicyUser_3).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor3);

          // via feePolicyUser_4 with FEE_CALCULATOR_TOKEN_SERVICE_FEE
          await testNativeToken1.mint(feePolicyUser_4.address, _amount);
          await testNativeToken1.connect(feePolicyUser_4).approve(router.address, _amount);
          const feeAmountFor4 = await router.feeAmountFor(1, feePolicyUser_4.address, testNativeToken1.address, _amount);
          await router.connect(feePolicyUser_4).lock(1, testNativeToken1.address, _amount, owner.address, feeAmountFor4);

          // service fee
          const serviceFee1 = initFlatFee;
          const serviceFe2 = _amount.mul(initFeePercentage).div(initPrecision);
          const serviceFe3 = initFlatFeePerToken;
          const serviceFe4 = _amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);

          const allServiceFee = serviceFe4.add(serviceFe3).add(serviceFe2).add(serviceFee1);

          const beforeMemberUpdateTokenFeeData = await router.tokenFeeData(testNativeToken1.address);

          expect(beforeMemberUpdateTokenFeeData.feesAccrued).to.equal(allServiceFee);
          expect(beforeMemberUpdateTokenFeeData.accumulator).to.equal(0);
          expect(beforeMemberUpdateTokenFeeData.previousAccrued).to.equal(0);
        });
      });
    });
  });

  describe('Diamond', async () => {
    beforeEach(async () => {
      await router.updateMember(bob.address, bobAdmin.address, true);
      await router.updateMember(carol.address, carolAdmin.address, true);
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
        [ethers.constants.AddressZero, 2, getSelectors(cutFacet)],
        [ethers.constants.AddressZero, 2, getSelectors(loupeFacet)],
        [ethers.constants.AddressZero, 2, getSelectors(feeCalculatorFacet)],
        [ethers.constants.AddressZero, 2, getSelectors(governanceFacet)],
        [ethers.constants.AddressZero, 2, getSelectors(ownershipFacet)],
        [ethers.constants.AddressZero, 2, getSelectors(pausableFacet)],
        [ethers.constants.AddressZero, 2, getSelectors(routerFacet)],
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

      const pausabilityFacetFactory = await ethers.getContractFactory('TokenPausabilityFacet');
      const pausabilityFacet = await pausabilityFacetFactory.deploy();
      await pausabilityFacet.deployed();

      const diamondCut = [
        { facetAddress: pausabilityFacet.address, action: 0, functionSelectors: getSelectors(pausabilityFacet) }
      ];

      await expect(router.diamondCut(diamondCut, ethers.constants.AddressZero, '0x')).to.not.be.reverted;
      const contract = await diamondAsFacet(diamond, 'TokenPausabilityFacet');
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
      await router.updateMember(bob.address, bobAdmin.address, true);
    });

    it('adds member with one existing token', async () => {
      const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
      await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);

      await router.updateMember(bob.address, bobAdmin.address, true);
    });

    it('adds member with two existing tokens', async () => {
      // given
      const serviceFee = amount.mul(FEE_CALCULATOR_TOKEN_SERVICE_FEE).div(FEE_CALCULATOR_PRECISION);
      const otherNativeToken = await nativeTokenFactory.deploy('OtherNativeToken', 'NT', 18);
      await otherNativeToken.deployed();
      await otherNativeToken.mint(nonMember.address, amount);
      await otherNativeToken.connect(nonMember).approve(router.address, amount);

      await router.updateNativeToken(nativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.updateNativeToken(otherNativeToken.address, FEE_CALCULATOR_TOKEN_SERVICE_FEE, true);
      await router.connect(nonMember).lock(1, nativeToken.address, amount, owner.address, serviceFee);
      await router.connect(nonMember).lock(1, otherNativeToken.address, amount, owner.address, serviceFee);

      // when
      await router.updateMember(bob.address, bobAdmin.address, true);
    });
  });
});
