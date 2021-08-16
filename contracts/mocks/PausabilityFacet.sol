// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/LibDiamond.sol";
import "../WrappedToken.sol";

contract PausabilityFacet {
    function pause(address _token) external {
        LibDiamond.enforceIsContractOwner();

        WrappedToken(_token).pause();
    }

    function unpause(address _token) external {
        LibDiamond.enforceIsContractOwner();

        WrappedToken(_token).unpause();
    }
}
