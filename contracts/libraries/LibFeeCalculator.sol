// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./LibGovernance.sol";
import "./LibFeePolicy.sol";
import "../interfaces/IFeePolicy.sol";

library LibFeeCalculator {
    bytes32 constant STORAGE_POSITION = keccak256("fee.calculator.storage");

    /// @notice Represents a fee calculator per token
    struct FeeCalculator {
        // The current service fee in percentage. Range is between 0 and Storage.precision
        uint256 serviceFeePercentage;
        // Total fees accrued since contract deployment
        uint256 feesAccrued;
        // Total fees accrued up to the last point a member claimed rewards
        uint256 previousAccrued;
        // Accumulates rewards on a per-member basis
        uint256 accumulator;
        // Total rewards claimed per member
        mapping(address => uint256) claimedRewardsPerAccount;
    }

    struct Storage {
        bool initialized;
        // Precision for every calculator's fee percentage.
        uint256 precision;
        // A mapping consisting of all token fee calculators
        mapping(address => FeeCalculator) nativeTokenFeeCalculators;
    }

    function feeCalculatorStorage() internal pure returns (Storage storage ds) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /// @return The current precision for service fee calculations of tokens
    function precision() internal view returns (uint256) {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        return fcs.precision;
    }

    /// @notice Sets the initial claimed rewards for new members for a given token
    /// @param _account The address of the new member
    /// @param _token The list of tokens
    function addNewMember(address _account, address _token) internal {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];
        accrue(fc);

        fc.claimedRewardsPerAccount[_account] = fc.accumulator;
    }

    /// @notice Accumulate fees for token and claim reward for claimer
    /// @param _claimer The address of the claimer
    /// @param _token The target token
    /// @return The claimable amount
    function claimReward(address _claimer, address _token)
        internal
        returns (uint256)
    {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];
        accrue(fc);

        uint256 claimableAmount = fc.accumulator -
            fc.claimedRewardsPerAccount[_claimer];

        fc.claimedRewardsPerAccount[_claimer] = fc.accumulator;

        return claimableAmount;
    }

    /// @notice Returns service fee for specific bridge operation by first look for a fee policy.
    /// @param _targetChain The target chain for the bridging operation.
    /// @param _userAddress User address subject of the fee.
    /// @param _tokenAddress Token address subject of the fee.
    /// @param _amount The amount of tokens to bridge.
    /// @return Service fee for the bridge operation.
    function feeAmountFor(
        uint256 _targetChain,
        address _userAddress,
        address _tokenAddress,
        uint256 _amount
    ) internal view returns (uint256) {
        uint256 serviceFee = 0;
        bool policyExists = false;

        address userFeePolicyAddress = LibFeePolicy.feePolicyStoreAddress(
            _userAddress
        );
 
        if (userFeePolicyAddress != address(0)) {
            (serviceFee, policyExists) = IFeePolicy(userFeePolicyAddress)
                .feeAmountFor(
                    _targetChain,
                    _userAddress,
                    _tokenAddress,
                    _amount
                );
        }

        if (!policyExists) {
            LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
            FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[
                _tokenAddress
            ];

            serviceFee = calcServiceFee(
                _amount,
                fc.serviceFeePercentage,
                fcs.precision
            );
        }

        return serviceFee;
    }

    /// @notice Distributes service fee for given token
    /// @param _token The target token
    /// @param _amount The amount to which the service fee will be calculated
    /// @return serviceFee The calculated service fee
    function distributeRewards(address _token, uint256 _amount)
        internal
        returns (uint256)
    {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];
        uint256 serviceFee = calcServiceFee(
            _amount,
            fc.serviceFeePercentage,
            fcs.precision
        );
        fc.feesAccrued = fc.feesAccrued + serviceFee;

        return serviceFee;
    }

    /// @notice Distributes service fee for given token with already calculated fee.
    /// @dev Usual execution of the method is unlock operation from the validators.
    /// @param _token The target token
    /// @param _amount The amount to which the service fee will be calculated
    /// @param _serviceFee The calculated fee
    /// @return serviceFee The calculated service fee
    function distributeRewardsWithFee(
        address _token,
        uint256 _amount,
        uint256 _serviceFee
    ) internal returns (uint256) {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];

        fc.feesAccrued = fc.feesAccrued + _serviceFee;

        return _serviceFee;
    }

    /// @notice Calculates a service fee value based on input parameters
    /// @param _amount The amount to which the service fee will be calculated
    /// @param _serviceFeePercentage The service fee percentage to be used in the calculation
    /// @param _precision The precision for service fee calculations
    /// @return serviceFee The calculated service fee
    function calcServiceFee(
        uint256 _amount,
        uint256 _serviceFeePercentage,
        uint256 _precision
    ) internal pure returns (uint256) {
        return (_amount * _serviceFeePercentage) / _precision;
    }

    /// @notice Sets service fee for a token
    /// @param _token The target token
    /// @param _serviceFeePercentage The service fee percentage to be set
    function setServiceFee(address _token, uint256 _serviceFeePercentage)
        internal
    {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        require(
            _serviceFeePercentage < fcs.precision,
            "LibFeeCalculator: service fee percentage exceeds or equal to precision"
        );

        FeeCalculator storage ntfc = fcs.nativeTokenFeeCalculators[_token];
        ntfc.serviceFeePercentage = _serviceFeePercentage;
    }

    /// @notice Accrues fees to a fee calculator
    /// @param _fc The fee calculator
    /// @return The updated accumulator
    function accrue(FeeCalculator storage _fc) internal returns (uint256) {
        uint256 members = LibGovernance.membersCount();
        uint256 amount = (_fc.feesAccrued - _fc.previousAccrued) / members;
        //slither-disable-next-line divide-before-multiply
        _fc.previousAccrued += amount * members;
        _fc.accumulator = _fc.accumulator + amount;

        return _fc.accumulator;
    }

    /// @notice Accrues fees to a fee calculator
    /// @param _token The target token to which fee calculator the amount will be accrued
    /// @param _amount The amount to be accrued
    function accrueFee(address _token, uint256 _amount) internal {
        LibFeeCalculator.Storage storage fcs = feeCalculatorStorage();
        FeeCalculator storage fc = fcs.nativeTokenFeeCalculators[_token];
        fc.feesAccrued = fc.feesAccrued + _amount;
    }
}
