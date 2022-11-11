// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

/// @notice Fee policy with specific percentage fee without other restricctions.
/// @dev In order to perform correct perentage calculataions - this contract needs percentage precision.
contract PercentageFeePolicy is IFeePolicy, Ownable {
    /// @notice Precision needed for correct math calculations.
    uint256 public precision;

    /// @notice The percentage fee of the policy
    uint256 public feePercentage;

    /// @param _precision Precision value to be set.
    /// @param _feePercentage Percentage fee value to be set.
    constructor(uint256 _precision, uint256 _feePercentage) {
        require(_precision > 0, "Value of _precision is zero");
        require(_feePercentage > 0, "Value of _feePercentage is zero");

        precision = _precision;
        feePercentage = _feePercentage;
    }

    /// @notice Sets current precision value.
    /// @param _precision Precision value to be changed.
    function setPrecision(uint256 _precision) external onlyOwner {
        require(_precision > 0, "Value of _precision is zero");

        precision = _precision;
    }

    /// @notice Sets current percentage fee value.
    /// @param _feePercentage Percentage fee value to be changed.
    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage > 0, "Value of _feePercentage is zero");

        feePercentage = _feePercentage;
    }

    /// @notice Calculates the fee amount.
    /// @dev This method is implemenation of IFeePolicy.feeAmountFor(uint256,address,address,uint256).
    /// @param _amount The amount to which the service fee will be calculated.
    /// @return feeAmount Calcualated value of the fee.
    /// @return exist Flag describing if fee amount is calculated. For the current implementation - it is always true.
    function feeAmountFor(
        uint256,
        address,
        address,
        uint256 _amount
    ) external view override returns (uint256 feeAmount, bool exist) {
        return ((_amount * feePercentage) / precision, true);
    }
}
