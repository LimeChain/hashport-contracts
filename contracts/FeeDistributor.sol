pragma solidity ^0.6.0;

import "./Interfaces/IGovernance.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 *  @author LimeChain Dev team
 *  @title PriceDistributor contract, providing fee distribution services
 */
abstract contract FeeDistributor is Ownable {
    using SafeMath for uint256;

    /// @notice The configured router contract
    address public routerContract;

    /// @notice Total checkpoints so far
    uint256 public totalCheckpoints;

    /// @notice Total fees that could be claimed
    uint256 public totalClaimableFees;

    /// @notice Total fees accrued per each checkpoint
    mapping(uint256 => uint256) public checkpointServiceFeesAccrued;

    /// @notice Mapping of members and the fees that they are eligble to claim.
    /// Does not include the fees of each member from the current checkpoint.
    mapping(address => uint256) public claimableFees;

    /// @notice An event emitted once a router contract is set
    event RouterContractSet(address routerContract, address setBy);

    /// @notice Creates a new checkpoint, distributing the accrued fees
    /// of the previous checkpoint to all members
    function _createNewCheckpoint() internal {
        uint256 mCount = IGovernance(routerContract).membersCount();
        if (mCount == 0) {
            return;
        }

        uint256 feesAccrued = checkpointServiceFeesAccrued[totalCheckpoints];
        uint256 feePerMember = feesAccrued.div(mCount);
        if (feePerMember == 0) {
            return;
        }

        uint256 feesTotal = feePerMember.mul(mCount);
        uint256 feesLeft = feesAccrued.sub(feesTotal); // fees left due to integer division
        totalCheckpoints++;
        checkpointServiceFeesAccrued[totalCheckpoints] = feesLeft;
        for (uint256 i = 0; i < mCount; i++) {
            address currentMember = IGovernance(routerContract).memberAt(i);
            claimableFees[currentMember] = claimableFees[currentMember].add(
                feePerMember
            );
        }
    }

    /**
     * @notice Set the address of the router contract
     * @param _routerContract the router contract address
     */
    function setRouterContract(address _routerContract) public onlyOwner {
        require(
            _routerContract != address(0),
            "FeeDistributor: Router contract cannot be zero"
        );
        routerContract = _routerContract;
        emit RouterContractSet(_routerContract, msg.sender);
    }

    /**
     * @notice Gets the claimable fee of a member, including the fee from the current checkpoint
     * @param _address the target address
     */
    function claimableFeesFor(address _address) public view returns (uint256) {
        if (!IGovernance(routerContract).isMember(_address)) {
            return claimableFees[_address];
        }

        uint256 currentCheckpointFeePerMember = 0;
        uint256 membersCount = IGovernance(routerContract).membersCount();
        if (membersCount > 0) {
            currentCheckpointFeePerMember = checkpointServiceFeesAccrued[
                totalCheckpoints
            ]
                .div(membersCount);
        }

        return claimableFees[_address].add(currentCheckpointFeePerMember);
    }
}
