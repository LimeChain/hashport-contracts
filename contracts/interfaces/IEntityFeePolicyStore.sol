// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IEntityFeePolicyStore {
    function removeFeePolicyToken(address _tokenAddress) external;

    function setFlatFeeTokenPolicy(address _tokenAddress, uint256 value) external;

    function setPercentageFeeTokenPolicy(address _tokenAddress, uint256 value) external;

    function addTierTokenPolicy(
        address _tokenAddress,
        uint256 feeType,
        uint256 amountFrom,
        uint256 amountTo,
        bool hasFrom,
        bool hasTo,
        uint256 feeValue
    ) external;

    function feeAmountFor(
        address _tokenAddress,
        uint256 _amount,
        uint256 _precision
    ) external view returns (uint256 feeAmount, bool exist);
}
