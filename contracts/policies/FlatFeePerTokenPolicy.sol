// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

contract FlatFeePerTokenPolicy is IFeePolicy, Ownable {
    // tokenAddress => flatFee
    mapping(address => uint256) pairs;

    /// @notice Gets current flat fee value for token.
    /// @param _tokenAddress Token address subject of the fee.
    function getFlatFee(address _tokenAddress) external view returns (uint256) {
        return pairs[_tokenAddress];
    }

    /// @notice Sets current flat fee value for token.
    /// @param _tokenAddress Token address subject of the fee.
    function setFlatFee(address _tokenAddress, uint256 _flatFee) external onlyOwner {
        require(_tokenAddress != address(0), "Token address must not be 0x0");

        pairs[_tokenAddress] = _flatFee;
    }

    /// @notice Returns the current flat fee
    /// @dev This method is implemenation of IFeePolicy.feeAmountFor
    /// @param _userAddress This parameter is ignored for the current implementation.
    /// @param _tokenAddress Token address subject of the fee.
    /// @param _amount This parameter is ignored for the current implementation.
    /// @return feeAmount Value of the fee. For the current implementation - the value is flatFee.
    /// @return exist Flag describing if fee amount is calculated. For the current implementation - it is always true.
    function feeAmountFor(
        address _userAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view override returns (uint256 feeAmount, bool exist) {

        if(pairs[_tokenAddress] > 0)
        {
            return (pairs[_tokenAddress], true);
        }

        return (0, false);
    }
}
