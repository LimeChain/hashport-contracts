// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

interface IWrappedToken {
    function mint(address account, uint256 amount) external;

    function burnFrom(address from, uint256 amount) external;

    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transfer(address to, uint256 amount) external;
}
