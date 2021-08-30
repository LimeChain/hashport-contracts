// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPausable {
    // Emitted once the pause is triggered by an `account`
    event Paused(address indexed account);
    // Emitted once the pause is lifted by an `account`
    event Unpaused(address indexed account);

    /// @dev Returns true if the contract is paused, and false otherwise
    function paused() external view returns (bool);

    /// @dev Pauses the contract. Reverts if caller is not owner or already paused
    function pause() external;

    /// @dev Unpauses the contract. Reverts if the caller is not owner or already not paused
    function unpause() external;
}
