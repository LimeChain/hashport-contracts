// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEntityFeePolicyStore.sol";

/// @notice Describes the type of fee to be applied as [`Flat`, `Percentage`].
enum FeeType {
    Flat, // 0: flat fee
    Percentage // 1: percentage of the ammount
}

/// @notice Describes fee policy tier.
struct FeePolicyTierItem {
    FeeType feeType;
    uint256 amountFrom;
    uint256 amountTo;
    bool hasFrom;
    bool hasTo;
    uint256 feeValue;
}

/// @notice Deployed per Legal Entity. Describes and handles fee policies for group of address (part of the Legal Entity).
/// @dev Router is the owner of the contract
contract EntityFeePolicyStore is IEntityFeePolicyStore, Ownable {
    // tokenAddress => FeePolicyTierItem[]
    mapping(address => FeePolicyTierItem[]) tokenPolicies;

    // tokenAddress => exists
    // mapping(address => bool) tokenPolicyExists;

    /// @notice Check is fee poliies for token exists
    function feePolicyForExists(address _tokenAddress) external view override returns (bool) {
        return tokenPolicies[_tokenAddress].length > 0;
    }

    /// @notice Removes token address from EntityFeePolicyStore
    /// @param _tokenAddress Address of a token to be removed from the policy
    function removeFeePolicyToken(address _tokenAddress) external override onlyOwner {
        delete tokenPolicies[_tokenAddress];
    }

    /// @notice Sets flat fee policy to token by EntityFeePolicyStore
    /// @param _tokenAddress Address of the token subject to the fee policy
    /// @param _value Value of the flat fee
    function setFlatFeeTokenPolicy(address _tokenAddress, uint256 _value) external override onlyOwner {
        // assure only one FeePolicyTierItem for token
        if (tokenPolicies[_tokenAddress].length > 0) {
            delete tokenPolicies[_tokenAddress];
        }

        tokenPolicies[_tokenAddress].push(
            FeePolicyTierItem({feeType: FeeType.Flat, amountFrom: 0, amountTo: 0, hasFrom: false, hasTo: false, feeValue: _value})
        );
    }

    /// @notice Sets percentage fee policy to token by EntityFeePolicyStore
    /// @param _tokenAddress Address of the token subject to the fee policy
    /// @param _value Value of the percentage fee
    function setPercentageFeeTokenPolicy(address _tokenAddress, uint256 _value) external override onlyOwner {
        // assure only one FeePolicyTierItem for token
       if (tokenPolicies[_tokenAddress].length > 0) {
            delete tokenPolicies[_tokenAddress];
        }

        tokenPolicies[_tokenAddress].push(
            FeePolicyTierItem({feeType: FeeType.Percentage, amountFrom: 0, amountTo: 0, hasFrom: false, hasTo: false, feeValue: _value})
        );
    }

    /// @notice Adds tier fee policies to token by EntityFeePolicyStore.
    /// @dev If the tier group for the given token does not exists - it will be created.
    /// @param _tokenAddress Address of the token subject to the fee policy
    /// @param feeType Tier fee type.
    /// @param amountFrom Min amount range.
    /// @param amountTo Max amount range.
    /// @param hasFrom Descrbes whenever min amount range is set.
    /// @param hasTo Descrbes whenever min amount range is set.
    /// @param feeValue Fee amount.
    function addTierTokenPolicy(
        address _tokenAddress,
        uint256 feeType,
        uint256 amountFrom,
        uint256 amountTo,
        bool hasFrom,
        bool hasTo,
        uint256 feeValue
    ) external override onlyOwner {
        tokenPolicies[_tokenAddress].push(FeePolicyTierItem(FeeType(feeType), amountFrom, amountTo, hasFrom, hasTo, feeValue));
    }

    /// @notice Gets fee amount for token by looping thr all fee polcy tiers.
    /// @param _tokenAddress Address of the token subject to the fee policy.
    /// @param _amount The amount to which the service fee will be calculated.
    /// @param _precision The current precision for fee calculations of tokens
    /// @return feeAmount Value of the fee.
    /// @return exist Flag describing if fee amount is calculated.
    function feeAmountFor(
        address _tokenAddress,
        uint256 _amount,
        uint256 _precision
    ) external view override returns (uint256 feeAmount, bool exist) {
        if (tokenPolicies[_tokenAddress].length > 0) {
            FeePolicyTierItem[] storage tiers = tokenPolicies[_tokenAddress];

            if (tiers.length == 1) {
                (feeAmount, exist) = calculateFeeAmount(tiers[0], _amount, _precision);
            } else {
                for (uint256 i = 0; i < tiers.length; i++) {
                    FeePolicyTierItem storage range = tiers[i];

                    (feeAmount, exist) = calculateFeeAmount(range, _amount, _precision);
                    if (exist) break;
                }
            }
        }

        return (feeAmount, exist);
    }

    /// @notice Calculates fee amount for token if the token respects the fee policy tier.
    /// @param _amount The amount to which the service fee will be calculated.
    /// @param _precision The current precision for fee calculations of tokens
    /// @return feeAmount Value of the fee.
    /// @return exist Flag describing if fee amount is calculated.
    function calculateFeeAmount(
        FeePolicyTierItem storage range,
        uint256 _amount,
        uint256 _precision
    ) private view returns (uint256 feeAmount, bool exist) {
        if ((!range.hasFrom || _amount >= range.amountFrom) && (!range.hasTo || _amount < range.amountTo)) {
            // policy is found

            if (range.feeType == FeeType.Percentage) {
                // calculate by percentage
                return ((_amount * range.feeValue) / _precision, true);
            } else if (range.feeType == FeeType.Flat) {
                // just return the flat fee
                return (range.feeValue, true);
            }
        }

        return (0, false);
    }
}
