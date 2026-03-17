// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../interfaces/IFeeDistributor.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeDistributor.sol";
import "../libraries/LibGovernance.sol";

contract FeeDistributorFacet is IFeeDistributor {
    /// @notice Initialises the FeeDistributor
    function initFeeDistributor() external override {
        LibFeeDistributor.Storage storage fds = LibFeeDistributor
            .feeDistributorStorage();
        require(!fds.initialized, "FeeDistributorFacet: already initialized");
        fds.initialized = true;
    }

    /// @notice Returns all data for the fee calculator
    /// @return feesAccrued Total fees accrued since contract deployment
    /// @return previousAccrued Total fees accrued up to the last point a member claimed rewards
    /// @return accumulator Accumulates rewards on a per-member basis
    function feeData()
        external
        view
        override
        returns (uint256, uint256, uint256)
    {
        LibFeeDistributor.Storage storage s = LibFeeDistributor
            .feeDistributorStorage();

        return (s.feesAccrued, s.previousAccrued, s.accumulator);
    }

    /// @param _account The address of a validator
    /// @return The total amount of claimed fees by the provided validator address
    function claimedRewardsPerAccount(address _account)
        external
        view
        override
        returns (uint256)
    {
        return
            LibFeeDistributor
                .feeDistributorStorage()
                .claimedRewardsPerAccount[_account];
    }

    /// @notice Sends out the fees reward accumulated by the member
    /// to the member admin
    /// @param _member The member address to claim rewards for
    function claim(address _member) external override onlyMember(_member) {
        LibGovernance.enforceNotPaused();
        uint256 claimableAmount = LibFeeDistributor.claimReward(_member);
        address memberAdmin = LibGovernance.memberAdmin(_member);
        (bool success, ) = memberAdmin.call{value: claimableAmount}("");
        require(success, "FeeDistributorFacet: fees transfer failed");
        emit Claim(_member, memberAdmin, claimableAmount);
    }

    /// @notice Accepts only calls where `_member` is an active validator
    modifier onlyMember(address _member) {
        require(
            LibGovernance.isMember(_member),
            "FeeDistributorFacet: _member is not a member"
        );
        _;
    }
}
