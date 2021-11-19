// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IGovernanceV2.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibGovernance.sol";
import "../libraries/LibPayment.sol";
import "../libraries/LibRouter.sol";

contract GovernanceV2Facet is IGovernanceV2 {
    using SafeERC20 for IERC20;

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
}
