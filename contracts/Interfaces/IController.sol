pragma solidity ^0.6.0;

interface IController {
    function mint(
        address wrappedToken,
        address receiver,
        uint256 amountToMint
    ) external;

    function burnFrom(
        address wrappedToken,
        address account,
        uint256 amount
    ) external;
}
