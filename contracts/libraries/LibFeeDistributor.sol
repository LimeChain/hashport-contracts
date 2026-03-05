// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./LibGovernance.sol";

library LibFeeDistributor {
    bytes32 constant STORAGE_POSITION = keccak256("fee.distributor.storage");

    /// @notice Accumulates fees distributed among validators
    struct FeeCalculator {
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
        FeeCalculator nativeGasFeeCalculator;
    }

    function feeDistributorStorage() internal pure returns (Storage storage ds) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @notice Sets the initial claimed rewards for a new member
    /// @param _account The address of the new member
    function addNewMember(address _account) internal {
        FeeCalculator storage fc = feeDistributorStorage().nativeGasFeeCalculator;
        accrue(fc);
        fc.claimedRewardsPerAccount[_account] = fc.accumulator;
    }

    /// @notice Accrues fees and returns the claimable fees reward amount for the claimer
    /// @param _claimer The address of the claimer
    /// @return The claimable amount
    function claimReward(address _claimer) internal returns (uint256) {
        FeeCalculator storage fc = feeDistributorStorage().nativeGasFeeCalculator;
        accrue(fc);

        uint256 claimableAmount = fc.accumulator -
            fc.claimedRewardsPerAccount[_claimer];

        fc.claimedRewardsPerAccount[_claimer] = fc.accumulator;

        return claimableAmount;
    }

    /// @notice Records an incoming fees into the accumulator
    /// @param _amount The amount of fees to distribute
    function distributeFee(uint256 _amount) internal {
        feeDistributorStorage().nativeGasFeeCalculator.feesAccrued += _amount;
    }

    /// @notice Accrues pending fees to the per-member accumulator
    /// @param _fc The fee calculator storage reference
    /// @return The updated accumulator value
    function accrue(FeeCalculator storage _fc) internal returns (uint256) {
        uint256 members = LibGovernance.membersCount();
        uint256 amount = (_fc.feesAccrued - _fc.previousAccrued) / members;
        //slither-disable-next-line divide-before-multiply
        _fc.previousAccrued += amount * members;
        _fc.accumulator = _fc.accumulator + amount;

        return _fc.accumulator;
    }
}
