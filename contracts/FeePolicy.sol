// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./interfaces/IFeePolicy.sol";

struct Range {
    uint256 from;
    uint256 to;
    bool hasFrom;
    bool hasTo;
    uint256 feeAmount;
}

enum FeeType {
    FLAT, 
    TIERED_PERCENTAGE
}

struct FeeInfo {
    FeeType feeType;
    Range[] ranges;
    uint256 feeAmount;
    bool exist;
}


contract FeePolicy is IFeePolicy {
    mapping (address => FeeInfo) feeInfoPerToken;
    
    //////////////
    // External //
    //////////////
    
    function serviceFeeFor(address token, uint256 amount) view external override returns(uint256 feeAmount, bool exist) {
        require(amount >= 0, "Invalid amount.");
        require(token != address(0), "Invalid token address.");

        FeeInfo storage feeInfo = feeInfoPerToken[token];
        exist = feeInfo.exist;
        if (exist == true) {
            if (feeInfo.feeType == FeeType.FLAT) {
                feeAmount = feeInfo.feeAmount;
            } else {
                return getFeeAmountInRange(feeInfo, amount);
            }
        }
    }

    //////////////
    // Internal //
    //////////////

    function getFeeAmountInRange(FeeInfo storage feeInfo, uint256 amount) internal view returns(uint256 feeAmount, bool exist) {
        require(feeInfo.ranges.length > 0, "No amount ranges are specified for the token.");
        if (feeInfo.ranges.length == 1) {
            return checkAmountInRangeAtIndex(feeInfo, amount, 0);
        } else {
            exist = false;
            for (uint i = 0; i < feeInfo.ranges.length; i++) {
                (feeAmount, exist) = checkAmountInRangeAtIndex(feeInfo, amount, i);
                if (exist == true) {
                    return (feeAmount, exist);
                }
            }
        }
    }

    function checkAmountInRangeAtIndex(FeeInfo storage feeInfo, uint256 amount, uint index) internal view returns(uint256 feeAmount, bool exist) {
        Range storage range = feeInfo.ranges[index]; 
        if ((range.hasFrom == false || amount >= range.from) 
            && (range.hasTo == false || amount < range.to)) {
                return (range.feeAmount, true);
        }
        exist = false;
    }
}