pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

/**
 *  @author LimeChain Dev team
 *  @title Governance contract, providing governance/members functionality
 */
abstract contract Governance is Ownable {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Iterable set of members
    EnumerableSet.AddressSet private membersSet;

    /// @notice Total checkpoints so far
    uint256 public totalCheckpoints = 0;

    /// @notice Total fees that could be claimed
    uint256 public totalClaimableFees;

    /// @notice Total fees accrued per each checkpoint
    mapping(uint256 => uint256) public checkpointServiceFeesAccrued;

    /// @notice Mapping of members and the fees that they are eligble to claim.
    /// Does not include the fees of each member from the current checkpoint.
    mapping(address => uint256) public claimableFees;

    /// @notice An event emitted once member is updated
    event MemberUpdated(address member, bool status);

    /// @notice Accepts only `msg.sender` part of the members
    modifier onlyMember() {
        require(isMember(msg.sender), "Governance: msg.sender is not a member");
        _;
    }

    /// @notice Construct a new Governance contract
    constructor() public {
        checkpointServiceFeesAccrued[totalCheckpoints] = 0; // sets value to allocate state
    }

    /**
     * @notice Adds/removes a member account. Not idempotent
     * @param account The account to be modified
     * @param isMember Whether the account will be set as member or not
     */
    function updateMember(address account, bool isMember) public onlyOwner {
        createNewCheckpoint();

        if (isMember) {
            require(
                membersSet.add(account),
                "Governance: Account already added"
            );
        } else if (!isMember) {
            require(
                membersSet.remove(account),
                "Governance: Account is not a member"
            );
        }
        emit MemberUpdated(account, isMember);
    }

    /// @notice Returns true/false depending on whether a given address is member or not
    function isMember(address _member) public view returns (bool) {
        return membersSet.contains(_member);
    }

    /// @notice Returns the count of the members
    function membersCount() public view returns (uint256) {
        return membersSet.length();
    }

    /// @notice Returns the address of a member at a given index
    function memberAt(uint256 index) public view returns (address) {
        return membersSet.at(index);
    }

    /// @notice Creates a new checkpoint, distributing the accrued fees
    /// of the previous checkpoint to all members
    function createNewCheckpoint() internal {
        if (membersCount() == 0) {
            return;
        }

        uint256 feesAccrued = checkpointServiceFeesAccrued[totalCheckpoints];
        uint256 feePerMember = feesAccrued.div(membersCount());
        if (feePerMember == 0) {
            return;
        }

        uint256 feesTotal = feePerMember.mul(membersCount());
        uint256 feesLeft = feesAccrued.sub(feesTotal); // fees left due to integer division
        totalCheckpoints++;
        checkpointServiceFeesAccrued[totalCheckpoints] = feesLeft;

        for (uint256 i = 0; i < membersCount(); i++) {
            address currentMember = memberAt(i);
            claimableFees[currentMember] = claimableFees[currentMember].add(
                feePerMember
            );
        }
    }

    /**
     * @notice Gets the claimable fee of a member, including the fee from the current checkpoint
     * @param _address the target address
     */
    function claimableFeesFor(address _address) public view returns (uint256) {
        if (!isMember(_address)) {
            return claimableFees[_address];
        }

        uint256 currentCheckpointFeePerMember = 0;
        if (membersCount() > 0) {
            currentCheckpointFeePerMember = checkpointServiceFeesAccrued[
                totalCheckpoints
            ]
                .div(membersCount());
        }

        return claimableFees[_address].add(currentCheckpointFeePerMember);
    }
}
