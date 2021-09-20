// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

contract ReplaceFacet {
    event Replacement();

    function owner() external returns (address) {
        emit Replacement();
        return address(this);
    }
}
