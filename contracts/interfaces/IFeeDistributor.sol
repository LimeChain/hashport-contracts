// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IFeeDistributor {
    /// @notice An event emitted once a member claims their fees rewards
    event Claim(
        address indexed member,
        address indexed memberAdmin,
        uint256 amount
    );

    /// @notice Initialises the FeeDistributor
    function initFeeDistributor() external;

    /// @notice Returns all data for the fee calculator
    /// @return feesAccrued Total fees accrued since contract deployment
    /// @return previousAccrued Total fees accrued up to the last point a member claimed rewards
    /// @return accumulator Accumulates rewards on a per-member basis
    function feeData()
        external
        view
        returns (
            uint256 feesAccrued,
            uint256 previousAccrued,
            uint256 accumulator
        );

    /// @param _account The address of a validator
    /// @return The total amount of feesclaimed by the provided validator address
    function claimedRewardsPerAccount(address _account)
        external
        view
        returns (uint256);

    /// @notice Sends out the fees reward accumulated by the member
    /// to the member admin
    /// @param _member The member address to claim rewards for
    function claim(address _member) external;
}
