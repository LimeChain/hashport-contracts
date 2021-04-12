pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

/**
 *  @author LimeChain Dev team
 *  @title Governance contract, providing governance/members functionality
 */
abstract contract Governance is Ownable {
    // using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Iterable set of members
    EnumerableSet.AddressSet private members;

    /// @notice An event emitted once member is updated
    event MemberUpdated(address member, bool status);

    /// @notice Accepts only `msg.sender` part of the members
    modifier onlyMember() {
        require(isMember(msg.sender), "Governance: msg.sender is not a member");
        _;
    }

    /**
     * @notice Adds/removes a member account. Not idempotent
     * @param account The account to be modified
     * @param isMember Whether the account will be set as member or not
     */
    function updateMember(address account, bool isMember) public onlyOwner {
        if (isMember) {
            require(members.add(account), "Governance: Account already added");
        } else if (!isMember) {
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
