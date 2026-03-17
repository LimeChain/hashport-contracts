// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./LibGovernance.sol";

library LibFeeDistributor {
    bytes32 constant STORAGE_POSITION = keccak256("fee.distributor.storage");

    struct Storage {
        bool initialized;
        // Total fees accrued since contract deployment
        uint256 feesAccrued;
        // Total fees accrued up to the last point a member claimed rewards
        uint256 previousAccrued;
        // Accumulates rewards on a per-member basis
        uint256 accumulator;
        // Total rewards claimed per member
        mapping(address => uint256) claimedRewardsPerAccount;
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
        Storage storage s = feeDistributorStorage();
        accrue(s);
        s.claimedRewardsPerAccount[_account] = s.accumulator;
    }

    /// @notice Accrues fees and returns the claimable fees reward amount for the claimer
    /// @param _claimer The address of the claimer
    /// @return The claimable amount
    function claimReward(address _claimer) internal returns (uint256) {
        Storage storage s = feeDistributorStorage();
        accrue(s);

        uint256 claimableAmount = s.accumulator -
            s.claimedRewardsPerAccount[_claimer];

        s.claimedRewardsPerAccount[_claimer] = s.accumulator;

        return claimableAmount;
    }

    /// @notice Accrues fees in the fee distributor
    /// @param _amount The amount of fees to accrue
    function accrueFee(uint256 _amount) internal {
        feeDistributorStorage().feesAccrued += _amount;
    }

    /// @notice Accrues pending fees to the per-member accumulator
    /// @param _s The storage reference
    /// @return The updated accumulator value
    function accrue(Storage storage _s) internal returns (uint256) {
        uint256 members = LibGovernance.membersCount();
        uint256 amount = (_s.feesAccrued - _s.previousAccrued) / members;
        //slither-disable-next-line divide-before-multiply
        _s.previousAccrued += amount * members;
        _s.accumulator = _s.accumulator + amount;

        return _s.accumulator;
    }
}
