// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/LibDiamond.sol";
import "../interfaces/IPausable.sol";

contract PausableFacet is IPausable {
    /// @dev Returns true if the contract is paused, and false otherwise
    function paused() external view override returns (bool) {
        return LibDiamond.paused();
    }

    /// @dev Pauses the contract. Reverts if caller is not owner or already paused
    function pause() external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.pause();
    }

    /// @dev Unpauses the contract. Reverts if the caller is not owner or already not paused
    function unpause() external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.unpause();
    }
}
