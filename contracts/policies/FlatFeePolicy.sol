// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFeePolicy.sol";

contract FlatFeePolicy is IFeePolicy, Ownable {
    uint256 flatFee;

    constructor(uint256 _flatFee) {
        flatFee = _flatFee;
    }

    function getFlatFee() external view returns (uint256) {
        return flatFee;
    }

    function setFlatFee(uint256 _flatFee) external onlyOwner {
        require(_flatFee > 0, "Value of _flatFee is zero");

        flatFee = _flatFee;
    }

    function feeAmountFor(
        address _userAddress,
        address _tokenAddress,
        uint256 _amount
    ) external view override returns (uint256 feeAmount, bool exist) {
        return (flatFee, true);
    }
}
