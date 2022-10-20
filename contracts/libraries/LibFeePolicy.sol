// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library LibFeePolicy {
    using EnumerableSet for EnumerableSet.AddressSet;
    bytes32 constant STORAGE_POSITION = keccak256("fee.policy.storage");

    struct Storage {
        // userAddress => storeAddress
        mapping(address => address) userStoreAddresses; 
    }

    function feePolicyStorage() internal pure returns (Storage storage ds) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @notice Adds array of user address to IFeePolicy
    /// @param _feePolicyAddress Address of IFeePolicy
    /// @param _userAddresses Array of user addresses to be added to the policy
    function setUsersFeePolicy(address _feePolicyAddress, address[] memory _userAddresses) internal {
        LibFeePolicy.Storage storage _localStorage = feePolicyStorage();

        for (uint256 i = 0; i < _userAddresses.length; i++) {
            _localStorage.userStoreAddresses[_userAddresses[i]] = _feePolicyAddress;
        }
    }

    /// @notice Gets address of IFeePolicy by user address
    /// @param _userAddress Address of the user
    /// @return Address for the IFeePolicy
    function feePolicyStoreAddress(address _userAddress) internal view returns (address) {
        LibFeePolicy.Storage storage _localStorage = feePolicyStorage();

        return _localStorage.userStoreAddresses[_userAddress];
    }
}
