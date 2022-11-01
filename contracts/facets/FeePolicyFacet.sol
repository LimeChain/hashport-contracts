// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../interfaces/IFeePolicyFacet.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibFeePolicy.sol";

contract FeePolicyFacet is IFeePolicyFacet {
    /// @notice Adds array of user address to IFeePolicy.
    /// @param _feePolicyAddress Address of IFeePolicy.
    /// @param _userAddresses Array of user addresses to be added to the policy.
    function setUsersFeePolicy(
        address _feePolicyAddress,
        address[] memory _userAddresses
    ) external override {
        LibDiamond.enforceIsContractOwner();

        require(
            _feePolicyAddress != address(0),
            "FeeCalculatorFacet: _feePolicyAddress must not be 0x0"
        );

        for (uint256 i = 0; i < _userAddresses.length; i++) {
            require(
                _userAddresses[i] != address(0),
                "FeeCalculatorFacet: userAddress must not be 0x0"
            );

            LibFeePolicy.setUserFeePolicy(_feePolicyAddress, _userAddresses[i]);
        }
    }

    /// @notice Removes array of users from IFeePolicy.
    /// @param _userAddresses Array of user addresses to be removed from the policy.
    function removeUsersFeePolicy(address[] memory _userAddresses)
        external
        override
    {
        LibDiamond.enforceIsContractOwner();

        for (uint256 i = 0; i < _userAddresses.length; i++) {
            require(
                _userAddresses[i] != address(0),
                "FeeCalculatorFacet: userAddress must not be 0x0"
            );

            LibFeePolicy.setUserFeePolicy(address(0), _userAddresses[i]);
        }
    }

    /// @notice Gets address of IFeePolicy by user address
    /// @dev Used for test purposes
    /// @param _userAddress Address of the user
    /// @return Address for the IFeePolicy
    function getUsersFeePolicyAddress(address _userAddress)
        external
        view
        override
        returns (address)
    {
        LibDiamond.enforceIsContractOwner();
        LibFeePolicy.Storage storage _feePolicyStorage = LibFeePolicy
            .feePolicyStorage();

        return _feePolicyStorage.userStoreAddresses[_userAddress];
    }

    /// @notice Accepts only `msg.sender` part of the members
    modifier onlyMember(address _member) {
        require(
            LibGovernance.isMember(_member),
            "FeeCalculatorFacet: _member is not a member"
        );
        _;
    }
}
