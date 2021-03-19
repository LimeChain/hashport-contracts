pragma solidity ^0.6.0;

interface IController {
    function mint(
        address receiver,
        uint256 amount,
        uint256 txCost,
        bytes calldata transactionId,
        address executorMember
    ) external returns (bool);

    function burn(
        address from,
        uint256 amount,
        bytes calldata receiver
    ) external returns (bool);

    function createNewCheckpoint() external returns (bool);

    function deprecate() external returns (bool);
}
