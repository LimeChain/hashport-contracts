// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

/// @notice Management of user to IFeePolicy links
interface IFeePolicyFacet {

    /// @notice Sets or remove IFeePolicy link with user addresses.
    /// @dev To remove IFeePolicy from user users - pass _feePolicyAddress as zero address.
    /// @param _feePolicyAddress Address of IFeePolicy.
    /// @param _userAddresses Array of user addresses to be added to the policy.
    function setUsersFeePolicy(address _feePolicyAddress, address[] memory _userAddresses) external;

    /// @notice Gets address of IFeePolicy by user address
    /// @dev Used for test purposes
    /// @param _userAddress Address of the user
    /// @return Address for the IFeePolicy
    function userFeePolicy(address _userAddress) external view returns (address);
}
