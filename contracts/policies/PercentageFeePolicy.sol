// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

contract PercentageFeePolicy is IFeePolicy, Ownable {
    uint256 precision;
    uint256 feePercentage;

    constructor(uint256 _precision, uint256 _feePercentage) {
        require(_precision > 0, "Value of _precision is zero");
        require(_feePercentage > 0, "Value of _feePercentage is zero");

        precision = _precision;
        feePercentage = _feePercentage;
    }

    function getPrecision() external view returns (uint256) {
        return precision;
    }

    function setPrecision(uint256 _precision) external onlyOwner {
        require(_precision > 0, "Value of _precision is zero");

        precision = _precision;
    }

    function getFeePercentage() external view returns (uint256) {
        return feePercentage;
    }

    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage > 0, "Value of _feePercentage is zero");

        feePercentage = _feePercentage;
    }

    /// @notice Calculates the fee amount.
    /// @dev This method is implemenation of IFeePolicy.feeAmountFor
    /// @param _targetChain This parameter is ignored for the current implementation.
    /// @param _userAddress This parameter is ignored for the current implementation.
    /// @param _tokenAddress This parameter is ignored for the current implementation.
    /// @param _amount The amount to which the service fee will be calculated.
    /// @return feeAmount Calcualated value of the fee.
    /// @return exist Flag describing if fee amount is calculated. For the current implementation - it is always true.
    function feeAmountFor(
        uint256 _targetChain,
        address _userAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view override returns (uint256 feeAmount, bool exist) {
        return ((_amount * feePercentage) / precision, true);
    }
}
