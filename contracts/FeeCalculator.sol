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

    function distributeRewards(
        address asset,
        uint256 txCost,
        uint256 serviceFeeInWTokens,
        address memberAddress
    ) internal {
        AssetData storage assetData = assetsData[asset];

        distributeRewards(asset, serviceFeeInWTokens);
        assetData.txCostsPerMember[memberAddress] = assetData.txCostsPerMember[
            memberAddress
        ]
            .add(txCost);
    }

    function distributeRewards(address asset, uint256 serviceFeeInWTokens)
        internal
    {
        AssetData storage assetData = assetsData[asset];

        assetData.previousAccrued = assetData.feesAccrued;
        assetData.feesAccrued = assetData.feesAccrued.add(serviceFeeInWTokens);
    }

    function calculateClaimableAmount(address asset, address claimer)
        internal
        returns (uint256)
    {
        AssetData storage assetData = assetsData[asset];
        uint256 amount =
            assetData.feesAccrued.sub(assetData.previousAccrued).div(
                membersCount()
            );

        assetData.accumulator = assetData.accumulator.add(amount);

        uint256 claimableAmount =
            assetData.claimedRewardsPerAccount[claimer].sub(amount);

        assetData.claimedRewardsPerAccount[claimer] = assetData
            .claimedRewardsPerAccount[claimer]
            .add(amount);

        return claimableAmount;
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
