// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IPayment.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibGovernance.sol";
import "../libraries/LibPayment.sol";
import "../libraries/LibRouter.sol";

contract PaymentFacet is IPayment {
    using SafeERC20 for IERC20;

    /// @notice Adds/removes a payment token
    /// @param _token The target token
    /// @param _status Whether the token will be added or removed
    function setPaymentToken(address _token, bool _status) external override {
        require(_token != address(0), "PaymentFacet: _token must not be 0x0");
        LibDiamond.enforceIsContractOwner();
        LibPayment.updatePaymentToken(_token, _status);

        emit SetPaymentToken(_token, _status);
    }

    /// @notice Adds/removes a member account
    /// @param _account The account to be modified
    /// @param _accountAdmin The admin of the account.
    /// Ignored if member account is removed
    /// @param _status Whether the account will be set as member or not
    function updateMember(
        address _account,
        address _accountAdmin,
        bool _status
    ) external override {
        LibDiamond.enforceIsContractOwner();

        if (_status) {
            for (uint256 i = 0; i < LibRouter.nativeTokensCount(); i++) {
                LibFeeCalculator.addNewMember(
                    _account,
                    LibRouter.nativeTokenAt(i)
                );
            }

            for (uint256 i = 0; i < LibPayment.tokensCount(); i++) {
                LibFeeCalculator.addNewMember(_account, LibPayment.tokenAt(i));
            }
        } else {
            for (uint256 i = 0; i < LibRouter.nativeTokensCount(); i++) {
                address accountAdmin = LibGovernance.memberAdmin(_account);
                address token = LibRouter.nativeTokenAt(i);
                uint256 claimableFees = LibFeeCalculator.claimReward(
                    _account,
                    token
                );
                IERC20(token).safeTransfer(accountAdmin, claimableFees);
            }

            for (uint256 i = 0; i < LibPayment.tokensCount(); i++) {
                address accountAdmin = LibGovernance.memberAdmin(_account);
                address token = LibPayment.tokenAt(i);
                uint256 claimableFees = LibFeeCalculator.claimReward(
                    _account,
                    token
                );
                IERC20(token).safeTransfer(accountAdmin, claimableFees);
            }

            _accountAdmin = address(0);
        }

        LibGovernance.updateMember(_account, _status);
        emit MemberUpdated(_account, _status);

        LibGovernance.updateMemberAdmin(_account, _accountAdmin);
        emit MemberAdminUpdated(_account, _accountAdmin);
    }

    /// @notice Gets whether the payment token is supported
    /// @param _token The target token
    function supportsPaymentToken(address _token)
        external
        view
        override
        returns (bool)
    {
        return LibPayment.containsPaymentToken(_token);
    }

    /// @notice Gets the total amount of token payments
    function totalPaymentTokens() external view override returns (uint256) {
        return LibPayment.totalPaymentTokens();
    }

    /// @notice Gets the payment token at a given index
    /// @param _index The token index
    function paymentTokenAt(uint256 _index)
        external
        view
        override
        returns (address)
    {
        return LibPayment.paymentTokenAt(_index);
    }
}
