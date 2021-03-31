pragma solidity ^0.6.0;

import "./Governance.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 *  @author LimeChain Dev team
 *  @title PriceDistributor contract, providing fee distribution services
 */
abstract contract FeeCalculator is Governance {
    using SafeMath for uint256;

    /// @notice Precision of the service fee
    uint256 constant PRECISION = 100000;

    /// @notice Value of the service fee in percentage. Range 0% to 99.999% multiplied my 1000
    uint256 public serviceFee;

    /// @notice Storage wrappedToken address -> wrappedToken metadata structure.
    mapping(address => WrappedTokenData) public wrappedTokensData;

    struct WrappedTokenData {
        uint256 feesAccrued;
        uint256 previousAccrued;
        uint256 accumulator;
        mapping(address => uint256) claimedRewardsPerAccount;
        mapping(address => uint256) txCostsPerMember;
    }

    /// @notice An event emitted once the service fee is modified
    event ServiceFeeSet(address account, uint256 newServiceFee);

    /**
     *  @notice Construct a new FeeCalculator contract
     *  @param _serviceFee The initial service fee in percentage. Range 0% to 99.999% multiplied my 1000.
     */
    constructor(uint256 _serviceFee) public onlyValidServiceFee(_serviceFee) {
        serviceFee = _serviceFee;
    }

    /// @notice Accepts only service fee between 0 and PRECISION
    modifier onlyValidServiceFee(uint256 _serviceFee) {
        require(
            _serviceFee < PRECISION,
            "Controller: Service fee cannot exceed 100%"
        );
        _;
    }

    function getTxCostsPerMember(address wrappedToken, address member)
        public
        view
        returns (uint256)
    {
        return wrappedTokensData[wrappedToken].txCostsPerMember[member];
    }

    /**
     * @notice DistributeRewards distribute rewards and transaction cost among members
     * @param wrappedToken The address of the wrappedToken
     * @param txCost The cost of the transaction
     * @param serviceFeeInWTokens The servive fee in tokens
     * @param memberAddress The address of the member which executes the transaction
     */
    function distributeRewards(
        address wrappedToken,
        uint256 txCost,
        uint256 serviceFeeInWTokens,
        address memberAddress
    ) internal {
        WrappedTokenData storage wrappedTokenData =
            wrappedTokensData[wrappedToken];

        wrappedTokenData.feesAccrued = wrappedTokenData.feesAccrued.add(
            serviceFeeInWTokens
        );

        wrappedTokenData.txCostsPerMember[memberAddress] = wrappedTokenData
            .txCostsPerMember[memberAddress]
            .add(txCost);
    }

    /**
     * @notice DistributeRewards distribute rewards and transaction cost among members
     * @param wrappedToken The address of the wrappedToken
     * @param serviceFeeInWTokens The servive fee in tokens
     */
    function distributeRewards(
        address wrappedToken,
        uint256 serviceFeeInWTokens
    ) internal {
        wrappedTokensData[wrappedToken].feesAccrued = wrappedTokensData[
            wrappedToken
        ]
            .feesAccrued
            .add(serviceFeeInWTokens);
    }

    /**
     * @notice _claimWrappedToken Make calculations based on fee distribution and returns the claimable amount
     * @param claimer The address of the claimer
     * @param wrappedToken The address of the wrapped token
     */
    function _claimWrappedToken(address claimer, address wrappedToken)
        internal
        returns (uint256)
    {
        WrappedTokenData storage wrappedTokenData =
            wrappedTokensData[wrappedToken];
        uint256 amount =
            wrappedTokenData
                .feesAccrued
                .sub(wrappedTokenData.previousAccrued)
                .div(membersCount());

        wrappedTokenData.previousAccrued = wrappedTokenData.feesAccrued;
        wrappedTokenData.accumulator = wrappedTokenData.accumulator.add(amount);

        uint256 claimableAmount =
            wrappedTokenData.accumulator.sub(
                wrappedTokenData.claimedRewardsPerAccount[claimer]
            );

        wrappedTokenData.claimedRewardsPerAccount[claimer] = wrappedTokenData
            .claimedRewardsPerAccount[claimer]
            .add(claimableAmount);

        claimableAmount = claimableAmount.add(
            wrappedTokenData.txCostsPerMember[claimer]
        );

        wrappedTokenData.txCostsPerMember[claimer] = 0;

        return claimableAmount;
    }

    /**
     * @notice addNewMember Sets the initial claimed rewards for new members
     * @param account The address of the new member
     * @param wrappedToken The address of the wrappedToken
     */
    function addNewMember(address account, address wrappedToken) internal {
        wrappedTokensData[wrappedToken].claimedRewardsPerAccount[
            account
        ] = wrappedTokensData[wrappedToken].accumulator;
    }

    /**
     * @notice Modifies the service fee
     * @param _serviceFee The new service fee
     */
    function setServiceFee(uint256 _serviceFee)
        public
        onlyValidServiceFee(_serviceFee)
        onlyOwner
    {
        serviceFee = _serviceFee;
        emit ServiceFeeSet(msg.sender, _serviceFee);
    }
}
