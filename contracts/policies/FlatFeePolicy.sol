// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

/// @notice Fee policy with specific flat fee without other restrictions.
contract FlatFeePolicy is IFeePolicy, Ownable {
    /// @notice The flat fee of the policy
    uint256 public flatFee;

    /// @param _flatFee Flat fee value to be set.
    constructor(uint256 _flatFee) {
        require(_flatFee > 0, "Value of _flatFee is zero");

        flatFee = _flatFee;
    }

    /// @notice Sets current flat fee value.
    /// @param _flatFee Flat fee value to be changed.
    function setFlatFee(uint256 _flatFee) external onlyOwner {
        require(_flatFee > 0, "Value of _flatFee is zero");

        flatFee = _flatFee;
    }

    /// @notice Returns the current flat fee.
    /// @dev This method is implementation of IFeePolicy.feeAmountFor(uint256,address,address,uint256).
    /// @return feeAmount Value of the fee. For the current implementation - the value is flatFee.
    /// @return exist Flag describing if fee amount is calculated. For the current implementation - it is always true.
    function feeAmountFor(
        uint256,
        address,
        address,
        uint256
    ) external view override returns (uint256 feeAmount, bool exist) {
        return (flatFee, true);
    }
}
