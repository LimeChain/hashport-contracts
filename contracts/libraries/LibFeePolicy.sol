// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library LibFeePolicy {
    using EnumerableSet for EnumerableSet.AddressSet;
    bytes32 constant STORAGE_POSITION = keccak256("fee.policy.storage");

    struct Storage {
        // storeAddress => userAddress[]
        mapping(address => EnumerableSet.AddressSet) storeUserAddresses;    

        // userAddress => storeAddress
        mapping(address => address) userStoreAddresses; // TODO : Confirm usage
    }

    function feePolicyStorage() internal pure returns (Storage storage ds) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @notice Adds array of user address to EntityFeePolicyStore
    /// @param _storeAddress Address of EntityFeePolicyStore
    /// @param _userAddresses Array of user addresses to be added to the policy
    function addFeePolicyUsers(address _storeAddress, address[] memory _userAddresses) internal {
        LibFeePolicy.Storage storage _localStorage = feePolicyStorage();

        for (uint256 i = 0; i < _userAddresses.length; i++) {
            _localStorage.userStoreAddresses[_userAddresses[i]] = _storeAddress;
            _localStorage.storeUserAddresses[_storeAddress].add(_userAddresses[i]);
        }
    }

    /// @notice Removes array of users from EntityFeePolicyStore
    /// @param _storeAddress Address of EntityFeePolicyStore
    /// @param _userAddresses Array of user addresses to be removed from the policy
    function removeFeePolicyUsers(address _storeAddress, address[] memory _userAddresses) internal{
        LibFeePolicy.Storage storage _localStorage = feePolicyStorage();

        for (uint256 i = 0; i < _userAddresses.length; i++) {
            delete _localStorage.userStoreAddresses[_userAddresses[i]];
            _localStorage.storeUserAddresses[_storeAddress].remove(_userAddresses[i]);
        }
    }

    /// @notice Gets address of EntityFeePolicyStore by user address
    /// @param _userAddress Address of the user
    /// @return Address for the EntityFeePolicyStore
    function feePolicyStoreAddress(address _userAddress) internal view returns (address) {
        LibFeePolicy.Storage storage _localStorage = feePolicyStorage();

        return _localStorage.userStoreAddresses[_userAddress];
    }
}
