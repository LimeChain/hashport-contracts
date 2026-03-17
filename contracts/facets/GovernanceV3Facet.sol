// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IGovernanceV3.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibGovernance.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibFeeDistributor.sol";
import "../libraries/LibRouter.sol";

contract GovernanceV3Facet is IGovernanceV3 {
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
            uint256 count = LibRouter.nativeTokensCount();
            for (uint256 i = 0; i < count; ) {
                LibFeeCalculator.addNewMember(
                    _account,
                    LibRouter.nativeTokenAt(i)
                );
                unchecked { i++; }
            }
            LibFeeDistributor.addNewMember(_account);
        } else {
            address accountAdmin = LibGovernance.memberAdmin(_account);
            uint256 count = LibRouter.nativeTokensCount();
            for (uint256 i = 0; i < count; ) {
                address token = LibRouter.nativeTokenAt(i);
                uint256 claimableFees = LibFeeCalculator.claimReward(
                    _account,
                    token
                );
                if (claimableFees > 0) {
                    IERC20(token).safeTransfer(accountAdmin, claimableFees);
                }
                unchecked { i++; }
            }
            uint256 claimableFee = LibFeeDistributor.claimReward(_account);
            if (claimableFee > 0) {
                (bool success, ) = accountAdmin.call{value: claimableFee}("");
                require(success, "GovernanceFacet: fee transfer failed");
            }
            _accountAdmin = address(0);
        }

        LibGovernance.updateMember(_account, _status);
        emit MemberUpdated(_account, _status);

        LibGovernance.updateMemberAdmin(_account, _accountAdmin);
        emit MemberAdminUpdated(_account, _accountAdmin);
    }
}
