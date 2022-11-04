// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

contract FlatFeePolicy is IFeePolicy, Ownable {
    uint256 flatFee;

    constructor(uint256 _flatFee) {
        require(_flatFee > 0, "Value of _flatFee is zero");

        flatFee = _flatFee;
    }

    /// @notice Gets current flat fee value.
    function getFlatFee() external view returns (uint256) {
        return flatFee;
    }

    /// @notice Sets current flat fee value.
    function setFlatFee(uint256 _flatFee) external onlyOwner {
        require(_flatFee > 0, "Value of _flatFee is zero");

        flatFee = _flatFee;
    }

    /// @notice Returns the current flat fee.
    /// @dev This method is implemenation of IFeePolicy.feeAmountFor.
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
