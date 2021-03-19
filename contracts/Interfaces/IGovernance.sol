pragma solidity ^0.6.0;

interface IGovernance {
    function isMember(address _member) external view returns (bool);

    function membersCount() external view returns (uint256);

    function memberAt(uint256 index) external view returns (address);
}
