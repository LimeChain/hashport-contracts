// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/IGovernance.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibGovernance.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibRouter.sol";

contract GovernanceFacet is IGovernance {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    function initGovernance(
        address[] memory _members,
        uint256 _percentage,
        uint256 _precision
    ) external override {
        LibGovernance.Storage storage gs = LibGovernance.governanceStorage();
        require(!gs.initialized, "GovernanceFacet: already initialized");
        require(
            _members.length > 0,
            "GovernanceFacet: Member list must contain at least 1 element"
        );
        require(_precision != 0, "GovernanceFacet: precision must not be zero");
        require(
            _percentage < _precision,
            "GovernanceFacet: percentage must be less or equal to precision"
        );
        gs.percentage = _percentage;
        gs.precision = _precision;
        gs.initialized = true;

        for (uint256 i = 0; i < _members.length; i++) {
            LibGovernance.updateMember(_members[i], true);
            emit MemberUpdated(_members[i], true);
        }
    }

    /// @notice Updates the percentage of minimum amount of members signatures required
    /// @param _percentage The new percentage
    function updateMembersPercentage(uint256 _percentage) external override {
        LibDiamond.enforceIsContractOwner();
        LibGovernance.updateMembersPercentage(_percentage);

        emit MembersPercentageUpdated(_percentage);
    }

    /// @notice Adds/removes a member account
    /// @param _account The account to be modified
    /// @param _status Whether the account will be set as member or not
    function updateMember(address _account, bool _status) external override {
        LibDiamond.enforceIsContractOwner();

        if (_status) {
            for (uint256 i = 0; i < LibRouter.nativeTokensCount(); i++) {
                LibFeeCalculator.addNewMember(
                    _account,
                    LibRouter.nativeTokenAt(i)
                );
            }
        } else {
            for (uint256 i = 0; i < LibRouter.nativeTokensCount(); i++) {
                address token = LibRouter.nativeTokenAt(i);
                uint256 claimableFees = LibFeeCalculator.claimReward(
                    _account,
                    token
                );
                IERC20(token).safeTransfer(_account, claimableFees);
            }
        }

        LibGovernance.updateMember(_account, _status);
        emit MemberUpdated(_account, _status);
    }

    /// @return True/false depending on whether a given address is member or not
    function isMember(address _member) external view override returns (bool) {
        return LibGovernance.isMember(_member);
    }

    /// @return The count of members in the members set
    function membersCount() external view override returns (uint256) {
        return LibGovernance.membersCount();
    }

    /// @return The address of a member at a given index
    function memberAt(uint256 _index) external view override returns (address) {
        return LibGovernance.memberAt(_index);
    }
}
