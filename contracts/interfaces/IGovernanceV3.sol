// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

/// @title IGovernanceV3
/// @notice Interface for GovernanceV3Facet. Defines the updateMember, which adds and
///         removes members, registering them for both ERC-20 fee rewards (LibFeeCalculator)
///         and native gas coin fee rewards (LibFeeDistributor). On removal, claims and
///         transfers accrued fees to the member admin.
interface IGovernanceV3 {
    /// @notice An event emitted once member is updated
    event MemberUpdated(address member, bool status);

    /// @notice An event emitted once a member's admin is updated
    event MemberAdminUpdated(address member, address admin);

    /// @notice Adds/removes a member account
    /// @param _account The account to be modified
    /// @param _accountAdmin The admin of the account.
    /// Ignored if member account is removed
    /// @param _status Whether the account will be set as member or not
    function updateMember(
        address _account,
        address _accountAdmin,
        bool _status
    ) external;
}
