// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../libraries/LibRouter.sol";

interface IRouterV2 {
    function unlockWithFee(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _nativeToken,
        uint256 _amount,
        address _receiver,
        uint256 _calculatedFee,
        bytes[] calldata _signatures
    ) external;
}
