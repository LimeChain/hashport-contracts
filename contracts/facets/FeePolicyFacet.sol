// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../interfaces/IFeePolicyFacet.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibFeePolicy.sol";

/// @notice Management of fee policies per user.
contract FeePolicyFacet is IFeePolicyFacet {
    /// @notice Sets or remove IFeePolicy link with user addresses.
    /// @dev To remove IFeePolicy from user - pass _feePolicyAddress as zero address.
    /// @param _feePolicyAddress Address of IFeePolicy.
    /// @param _userAddresses Array of user addresses to be added to the policy.
    function setUsersFeePolicy(
        address _feePolicyAddress,
        address[] memory _userAddresses
    ) external override {
        LibDiamond.enforceIsContractOwner();

        for (uint256 i = 0; i < _userAddresses.length; i++) {
            require(
                _userAddresses[i] != address(0),
                "FeePolicyFacet: userAddress must not be 0x0"
            );

            LibFeePolicy.setUserFeePolicy(_feePolicyAddress, _userAddresses[i]);
        }
    }

    /// @notice Gets address of IFeePolicy by user address
    /// @dev Used for test purposes
    /// @param _userAddress Address of the user
    /// @return Address for the IFeePolicy
    function userFeePolicy(address _userAddress)
        external
        view
        override
        returns (address)
    {
        return LibFeePolicy.userFeePolicy(_userAddress);
    }
}
