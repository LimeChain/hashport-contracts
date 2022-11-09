// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IFeePolicyFacet {
    function setUsersFeePolicy(address _feePolicyAddress, address[] memory _userAddresses) external;

    function userFeePolicyAddress(address _userAddress) external view returns (address);
}
