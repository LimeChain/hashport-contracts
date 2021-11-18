// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IPayment {
    /// @notice An event emitted once member is updated
    event MemberUpdated(address member, bool status);

    /// @notice An event emitted once a member's admin is updated
    event MemberAdminUpdated(address member, address admin);

    /// @notice An event emitted once a payment token is set
    event SetPaymentToken(address _token, bool _status);

    /// @notice Adds/removes a payment token
    /// @param _token The target token
    /// @param _status Whether the token will be added or removed
    function setPaymentToken(address _token, bool _status) external;

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

    /// @notice Gets whether the payment token is supported
    /// @param _token The target token
    function supportsPaymentToken(address _token) external view returns (bool);

    /// @notice Gets the total amount of token payments
    function totalPaymentTokens() external view returns (uint256);

    /// @notice Gets the payment token at a given index
    function paymentTokenAt(uint256 _index) external view returns (address);
}
