// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReplaceFacet {
    event Replacement();

    function owner() external returns (address) {
        emit Replacement();
        return address(this);
    }
}
