// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFeeCalculator.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibRouter.sol";

contract FeeCalculatorFacet is IFeeCalculator {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    /// @notice Construct a new FeeCalculator contract
    /// @param _precision The precision for every fee calculator
    function initFeeCalculator(uint256 _precision) external override {
        LibFeeCalculator.Storage storage fcs = LibFeeCalculator
            .feeCalculatorStorage();
        require(!fcs.initialized, "FeeCalculatorFacet: already initialized");
        require(
            _precision != 0,
            "FeeCalculatorFacet: precision must not be zero"
        );
        fcs.initialized = true;
        fcs.precision = _precision;
    }

    /// @return The current precision for service fee calculations of tokens
    function serviceFeePrecision() external view override returns (uint256) {
        return LibFeeCalculator.precision();
    }

    /// @notice Sets the service fee for this chain
    /// @param _token The target token
    /// @param _serviceFeePercentage The new service fee
    function setServiceFee(address _token, uint256 _serviceFeePercentage)
        external
        override
    {
        LibDiamond.enforceIsContractOwner();
        LibFeeCalculator.setServiceFee(_token, _serviceFeePercentage);
        emit ServiceFeeSet(msg.sender, _token, _serviceFeePercentage);
    }

    /// @param _account The address of a validator
    /// @param _token The token address
    /// @return The total amount of claimed tokens by the provided validator address
    function claimedRewardsPerAccount(address _account, address _token)
        external
        view
        override
        returns (uint256)
    {
        LibFeeCalculator.Storage storage fcs = LibFeeCalculator
            .feeCalculatorStorage();
        return
            fcs.nativeTokenFeeCalculators[_token].claimedRewardsPerAccount[
                _account
            ];
    }

    /// @notice Returns all data for a specific fee calculator
    /// @param _token The target token
    /// @return serviceFeePercentage The current service fee
    /// @return feesAccrued Total fees accrued since contract deployment
    /// @return previousAccrued Total fees accrued up to the last point a member claimed rewards
    /// @return accumulator Accumulates rewards on a per-member basis
    function tokenFeeData(address _token)
        external
        view
        override
        returns (
            uint256 serviceFeePercentage,
            uint256 feesAccrued,
            uint256 previousAccrued,
            uint256 accumulator
        )
    {
        LibFeeCalculator.Storage storage fcs = LibFeeCalculator
            .feeCalculatorStorage();
        LibFeeCalculator.FeeCalculator storage fc = fcs
            .nativeTokenFeeCalculators[_token];

        return (
            fc.serviceFeePercentage,
            fc.feesAccrued,
            fc.previousAccrued,
            fc.accumulator
        );
    }

    /// @notice Sends out the reward for a Token accumulated by the caller
    function claim(address _token) external override onlyMember {
        uint256 claimableAmount = LibFeeCalculator.claimReward(
            msg.sender,
            _token
        );
        IERC20(_token).safeTransfer(msg.sender, claimableAmount);
        emit Claim(msg.sender, _token, claimableAmount);
    }

    /// @notice Accepts only `msg.sender` part of the members
    modifier onlyMember() {
        require(
            LibGovernance.isMember(msg.sender),
            "FeeCalculatorFacet: msg.sender is not a member"
        );
        _;
    }
}