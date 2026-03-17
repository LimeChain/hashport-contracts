// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IRouterV2 {
    /// @notice An event emitted once a Lock transaction is executed
    event Lock(
        uint256 targetChain,
        address token,
        bytes receiver,
        uint256 amount,
        uint256 serviceFee
    );

    /// @notice An event emitted once an Unlock transaction is executed
    event Unlock(
        uint256 sourceChain,
        bytes transactionId,
        address token,
        uint256 amount,
        address receiver
    );

    /// @notice An event emitted once a Burn transaction is executed
    event Burn(
        uint256 targetChain,
        address token,
        uint256 amount,
        bytes receiver,
        uint256 serviceFee
    );

    /// @notice An event emitted once a native token is updated
    event NativeTokenUpdated(address token, bool status);

    function lock(
        uint256 _targetChain,
        address _nativeToken,
        uint256 _amount,
        bytes memory _receiver
    ) external payable;

    function lockWithPermit(
        uint256 _targetChain,
        address _nativeToken,
        uint256 _amount,
        bytes memory _receiver,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external payable;

    function unlock(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _nativeToken,
        uint256 _amount,
        address _receiver,
        bytes[] calldata _signatures
    ) external;

    function burn(
        uint256 _targetChain,
        address _wrappedToken,
        uint256 _amount,
        bytes memory _receiver
    ) external payable;

    function burnWithPermit(
        uint256 _targetChain,
        address _wrappedToken,
        uint256 _amount,
        bytes memory _receiver,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external payable;

    function updateNativeToken(
        address _nativeToken,
        bool _status
    ) external;
}
