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

    /// @notice Storage asset address -> asset metadata structure.
    mapping(address => AssetData) public assetsData;

    struct AssetData {
        uint256 feesAccrued;
        uint256 previousAccrued;
        uint256 accumulator;
        mapping(address => uint256) claimedRewardsPerAccount;
        mapping(address => uint256) txCostsPerMember;
    }

    /// @notice Accepts only service fee between 0 and PRECISION
    modifier onlyValidServiceFee(uint256 _serviceFee) {
        require(
            _serviceFee < PRECISION,
            "Controller: Service fee cannot exceed 100%"
        );
        _;
    }

    /// @notice An event emitted once the service fee is modified
    event ServiceFeeSet(address account, uint256 newServiceFee);

    /**
     * @notice DistributeRewards distribute rewards and transaction cost among members
     * @param asset The address of the asset
     * @param txCost The cost of the transaction
     * @param serviceFeeInWTokens The servive fee in tokens
     * @param memberAddress The address of the member which executes the transaction
     */
    function distributeRewards(
        address asset,
        uint256 txCost,
        uint256 serviceFeeInWTokens,
        address memberAddress
    ) internal {
        AssetData storage assetData = assetsData[asset];

        assetData.feesAccrued = assetData.feesAccrued.add(serviceFeeInWTokens);

        assetData.txCostsPerMember[memberAddress] = assetData.txCostsPerMember[
            memberAddress
        ]
            .add(txCost);
    }

    /**
     * @notice DistributeRewards distribute rewards and transaction cost among members
     * @param asset The address of the asset
     * @param serviceFeeInWTokens The servive fee in tokens
     */
    function distributeRewards(address asset, uint256 serviceFeeInWTokens)
        internal
    {
        assetsData[asset].feesAccrued = assetsData[asset].feesAccrued.add(
            serviceFeeInWTokens
        );
    }

    /**
     * @notice _claimAsset Make calculations based on fee distribution and returns the claimable amount
     * @param claimer The address of the claimer
     * @param asset The address of the asset
     */
    function _claimAsset(address claimer, address asset)
        internal
        returns (uint256)
    {
        AssetData storage assetData = assetsData[asset];
        uint256 amount =
            assetData.feesAccrued.sub(assetData.previousAccrued).div(
                membersCount()
            );

        assetData.previousAccrued = assetData.feesAccrued;
        assetData.accumulator = assetData.accumulator.add(amount);

        uint256 claimableAmount =
            assetData.accumulator.sub(
                assetData.claimedRewardsPerAccount[claimer]
            );

        assetData.claimedRewardsPerAccount[claimer] = assetData
            .claimedRewardsPerAccount[claimer]
            .add(claimableAmount);

        claimableAmount = claimableAmount.add(
            assetData.txCostsPerMember[claimer]
        );

        assetData.txCostsPerMember[claimer] = 0;

        return claimableAmount;
    }

    /**
     * @notice addNewMember Sets the initial claimed rewards for new members
     * @param account The address of the new member
     * @param asset The address of the asset
     */
    function addNewMember(address account, address asset) internal {
        assetsData[asset].claimedRewardsPerAccount[account] = assetsData[asset]
            .accumulator;
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
