// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IFeePolicy {
    function feeAmountFor(
        uint256 _targetChain,
        address _userAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view returns (uint256 feeAmount, bool exist);
}
