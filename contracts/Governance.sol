// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

/**
 *  @author LimeChain Dev team
 *  @title Governance contract, providing governance/members functionality
 */
abstract contract Governance is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @dev Iterable set of members
    EnumerableSet.AddressSet private members;

    /// @notice An event emitted once member is updated
    event MemberUpdated(address member, bool status);

    /**
     * @notice Adds/removes a member account. Not idempotent
     * @param account The account to be modified
     * @param isMember Whether the account will be set as member or not
     */
    function updateMember(address account, bool isMember) public onlyOwner {
        if (isMember) {
            require(members.add(account), "Governance: Account already added");
        } else {
            require(
                members.remove(account),
                "Governance: Account is not a member"
            );
        }
        emit MemberUpdated(account, isMember);
    }

    /// @notice Returns true/false depending on whether a given address is member or not
    function isMember(address _member) public view returns (bool) {
        return members.contains(_member);
    }

    /// @notice Returns the count of the members
    function membersCount() public view returns (uint256) {
        return members.length();
    }

    /// @notice Returns the address of a member at a given index
    function memberAt(uint256 index) public view returns (address) {
        return members.at(index);
    }
}
