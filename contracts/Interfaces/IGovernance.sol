pragma solidity ^0.6.0;

interface IGovernance {
    /// @notice Returns true/false depending on whether a given address is member or not
    function isMember(address _member) external view returns (bool);

    /// @notice Returns the count of the members
    function membersCount() external view returns (uint256);

    /// @notice Returns the address of a member at a given index
    function memberAt(uint256 index) external view returns (address);
}
