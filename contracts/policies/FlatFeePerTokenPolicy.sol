// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

/// @notice Fee policy with specific flat fee per tokens.
contract FlatFeePerTokenPolicy is IFeePolicy, Ownable {
    /// @notice Describes link between token to flat fee value.
    /// @dev tokenAddress => flatFee
    mapping(address => uint256) public tokenFees;

    /// @notice Describes if a flat fee is set for specific token.
    /// @dev tokenAddress => bool
    mapping(address => bool) public exists;

    /// @notice Sets current flat fee value for token.
    /// @param _tokenAddress Token address subject of the fee.
    function setFlatFee(address _tokenAddress, uint256 _flatFee)
        external
        onlyOwner
    {
        require(_tokenAddress != address(0), "Token address must not be 0x0");

        exists[_tokenAddress] = true;
        tokenFees[_tokenAddress] = _flatFee;
    }

    /// @notice Removes token from this policy.
    /// @param _tokenAddress Token address to be removed.
    function removeFlatFee(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Token address must not be 0x0");

        delete exists[_tokenAddress];
    }

    /// @notice Returns the current flat fee.
    /// @dev This method is implementation of IFeePolicy.feeAmountFor(uint256,address,address,uint256).
    /// @param _tokenAddress Token address subject of the fee.
    /// @return feeAmount Value of the fee. For the current implementation - the value is flatFee.
    /// @return exist Flag describing if fee amount is calculated.
    function feeAmountFor(
        uint256,
        address,
        address _tokenAddress,
        uint256
    ) external view override returns (uint256 feeAmount, bool exist) {
        if (exists[_tokenAddress]) {
            return (tokenFees[_tokenAddress], true);
        }

        return (0, false);
    }
}
