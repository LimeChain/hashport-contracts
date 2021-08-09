// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LibGovernance.sol";

library LibFeeCalculator {
    bytes32 constant STORAGE_POSITION = keccak256("fee.calculator.storage");

    /// @notice Represents a fee calculator per token
    struct FeeCalculator {
        // The current service fee in percentage. Range is between 0 and Storage.precision
        uint256 serviceFeePercentage;
        // Total fees accrued since contract deployment
        uint256 feesAccrued;
        // Total fees accrued up to the last point a member claimed rewards
        uint256 previousAccrued;
        // Accumulates rewards on a per-member basis
        uint256 accumulator;
        // Total rewards claimed per member
        mapping(address => uint256) claimedRewardsPerAccount;
    }

    struct Storage {
        bool initialized;
        // Precision for every calculator's fee percentage.
        uint256 precision;
        // A mapping consisting of all token fee calculators
        mapping(address => FeeCalculator) nativeTokenFeeCalculators;
    }

    function feeCalculatorStorage() internal pure returns (Storage storage ds) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @notice Sets the initial claimed rewards for new members for a given token
    /// @param _account The address of the new member
    /// @param _token The list of tokens
    function addNewMember(address _account, address _token) internal {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();

        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];
        uint256 amount = (fc.feesAccrued - fc.previousAccrued) /
            LibGovernance.membersCount();

        fc.previousAccrued = fc.feesAccrued;
        fc.accumulator = fc.accumulator + amount;
        fc.claimedRewardsPerAccount[_account] = fc.accumulator;
    }

    /// @notice Make calculations based on fee distribution and returns the claimable amount
    /// @param _claimer The address of the claimer
    /// @param _token The target token
    function claimReward(address _claimer, address _token)
        internal
        returns (uint256)
    {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();

        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];
        uint256 amount = (fc.feesAccrued - fc.previousAccrued) /
            LibGovernance.membersCount();

        fc.previousAccrued = fc.feesAccrued;
        fc.accumulator = fc.accumulator + amount;

        uint256 claimableAmount = fc.accumulator -
            fc.claimedRewardsPerAccount[_claimer];

        fc.claimedRewardsPerAccount[_claimer] = fc.accumulator;

        return claimableAmount;
    }

    /// @notice Distributes service fee for given token
    /// @param _token The target token
    /// @param _amount The amount to which the service fee will be calculated
    /// @return serviceFee The calculated service fee
    function distributeRewards(address _token, uint256 _amount)
        internal
        returns (uint256)
    {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];
        uint256 serviceFee = (_amount * fc.serviceFeePercentage) /
            fcs.precision;
        fc.feesAccrued = fc.feesAccrued + serviceFee;

        return serviceFee;
    }

    /// @notice Sets service fee for a token
    /// @param _token The targe token
    /// @param _serviceFeePercentage The service fee percentage to be set
    function setServiceFee(address _token, uint256 _serviceFeePercentage)
        internal
    {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        require(
            _serviceFeePercentage < fcs.precision,
            "LibFeeCalculator: service fee percentage exceeds or equal to precision"
        );

        FeeCalculator storage ntfc = fcs.nativeTokenFeeCalculators[_token];
        ntfc.serviceFeePercentage = _serviceFeePercentage;
    }
}
