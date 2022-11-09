// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../interfaces/IFeePolicyFacet.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibFeePolicy.sol";

contract FeePolicyFacet is IFeePolicyFacet {
    /// @notice Sets or remove IFeePolicy link with user addresses.
    /// @dev To remove IFeePolicy from user users - pass _feePolicyAddress as zero addres.
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
    function userFeePolicyAddress(address _userAddress)
        external
        view
        override
        returns (address)
    {
        LibFeePolicy.Storage storage _feePolicyStorage = LibFeePolicy
            .feePolicyStorage();

        return _feePolicyStorage.userStoreAddresses[_userAddress];
    }
}
