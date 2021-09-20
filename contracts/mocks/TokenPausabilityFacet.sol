// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../libraries/LibDiamond.sol";
import "../WrappedToken.sol";

contract TokenPausabilityFacet {
    function pause(address _token) external {
        LibDiamond.enforceIsContractOwner();

        WrappedToken(_token).pause();
    }

    function unpause(address _token) external {
        LibDiamond.enforceIsContractOwner();

        WrappedToken(_token).unpause();
    }
}
