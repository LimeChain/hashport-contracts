pragma solidity ^0.6.0;

interface IWrappedToken {
    function mint(address account, uint256 amount) external;

    function burnFrom(address from, uint256 amount) external;

    function transfer(address to, uint256 amount) external;
}
