// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

/// @notice Interface describing specific fee policy. 
/// @dev The actual contracts implementing this interface may vary by storage structure.
interface IFeePolicy {
    /// @notice Caclulates fee amount for given combination of parameters.
    /// @dev Actual implementation may not require all parameters.
    /// @param _targetChain If used - represents a chain ID.
    /// @param _userAddress If used - represents user address.
    /// @param _tokenAddress If used - represents token address.
    /// @param _amount If used - transaction amount subject to the fee.
    /// @return feeAmount Value of the fee.
    /// @return exist Flag describing if a fee polocy for the given parameters is found and calculated.
    function feeAmountFor(
        uint256 _targetChain,
        address _userAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view returns (uint256 feeAmount, bool exist);
}
