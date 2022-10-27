// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

contract FlatFeePerTokenPolicy is IFeePolicy, Ownable {
    // tokenAddress => flatFee
    mapping(address => uint256) pairs;

    // tokenAddress => bool
    mapping(address => bool) exists;

    /// @notice Gets current flat fee value for token.
    /// @param _tokenAddress Token address subject of the fee.
    function getFlatFee(address _tokenAddress) external view returns (uint256) {
        return pairs[_tokenAddress];
    }

    /// @notice Sets current flat fee value for token.
    /// @param _tokenAddress Token address subject of the fee.
    function setFlatFee(address _tokenAddress, uint256 _flatFee)
        external
        onlyOwner
    {
        require(_tokenAddress != address(0), "Token address must not be 0x0");

        exists[_tokenAddress] = true;
        pairs[_tokenAddress] = _flatFee;
    }

    function removeFlatFee(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Token address must not be 0x0");

        delete exists[_tokenAddress];
    }

    /// @notice Returns the current flat fee.
    /// @dev This method is implemenation of IFeePolicy.feeAmountFor.
    /// @param _targetChain This parameter is ignored for the current implementation.
    /// @param _userAddress This parameter is ignored for the current implementation.
    /// @param _tokenAddress Token address subject of the fee.
    /// @param _amount This parameter is ignored for the current implementation.
    /// @return feeAmount Value of the fee. For the current implementation - the value is flatFee.
    /// @return exist Flag describing if fee amount is calculated.
    function feeAmountFor(
        uint256 _targetChain,
        address _userAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view override returns (uint256 feeAmount, bool exist) {
        if (exists[_tokenAddress]) {
            return (pairs[_tokenAddress], true);
        }

        return (0, false);
    }
}
