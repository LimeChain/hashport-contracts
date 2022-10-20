// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IFeePolicy {
    function feeAmountFor(
        address _addressAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view returns (uint256 feeAmount, bool exist);
}
