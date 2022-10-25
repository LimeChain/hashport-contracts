// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

library LibFeePolicy {
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
    /// @param _userAddress User address to be added to the policy
    function setUserFeePolicy(address _feePolicyAddress, address _userAddress) internal {
        LibFeePolicy.Storage storage _localStorage = feePolicyStorage();

            _localStorage.userStoreAddresses[_userAddress] = _feePolicyAddress;
    }

    /// @notice Gets address of IFeePolicy by user address
    /// @param _userAddress Address of the user
    /// @return Address for the IFeePolicy
    function feePolicyStoreAddress(address _userAddress) internal view returns (address) {
        LibFeePolicy.Storage storage _localStorage = feePolicyStorage();

        return _localStorage.userStoreAddresses[_userAddress];
    }
}
