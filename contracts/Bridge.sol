pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Pausable.sol";
// import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "./Interfaces/IWrappedToken.sol";
import "./PriceDistributor.sol";

/**
 *  @author LimeChain Dev team
 *  @title HBAR Bridge Contract
 */
contract Bridge is PriceDistributor, Pausable {
    using SafeMath for uint256;

    /// @notice The configured wrappedToken
    IWrappedToken public wrappedToken;

    /// @notice Value of the service fee in percentage. Range 0% to 99.999% multiplied my 1000
    uint256 public serviceFee;

    /// @notice Precision of the service fee
    uint256 constant PRECISION = 100000;

    /// @notice Struct containing necessary metadata for a given transaction
    struct Transaction {
        bool isExecuted;
        mapping(address => bool) signatures;
    }

    /// @notice An event emitted once a Mint transaction is executed
    event Mint(
        address indexed account,
        uint256 amount,
        uint256 txCost,
        bytes indexed transactionId
    );

    /// @notice An event emitted once a Burn transaction is executed
    event Burn(
        address indexed account,
        uint256 amount,
        uint256 serviceFee,
        bytes receiver
    );

    /// @notice An event emitted once the service fee is modified
    event ServiceFeeSet(address account, uint256 newServiceFee);

    /// @notice An event emitted once Member claims fees accredited to him
    event Claim(address indexed account, uint256 amount);

    /// @notice An event emitted once this contract is deprecated by the owner
    event Deprecate(address account, uint256 amount);

    /**
     *  @notice Construct a new Bridge contract
     *  @param _wrappedToken The address of the ERC20 Wrapped token
     *  @param _serviceFee The initial service fee
     */
    constructor(address _wrappedToken, uint256 _serviceFee) public {
        wrappedToken = IWrappedToken(_wrappedToken);
        serviceFee = _serviceFee;
    }

    /// @notice Accepts only service fee between 0 and PRECISION
    modifier onlyValidServiceFee(uint256 _serviceFee) {
        require(
            _serviceFee < PRECISION,
            "Bridge: Service fee cannot exceed 100%"
        );
        _;
    }

    /// @notice Allows calls only from router contract
    modifier onlyRouterContract(address _routerContract) {
        require(
            _routerContract == routerContract,
            "Bridge: Only executable from the router contract"
        );
        _;
    }

    /**
     * @notice Mints `amount - fees` WrappedTokens to the `receiver` address. Must be authorised by `signatures` from the `members` set
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param txCost The amount of WrappedTokens reimbursed to `msg.sender`
     * @param transactionId The Hedera Transaction ID
     */
    function mint(
        address receiver,
        uint256 amount,
        uint256 txCost,
        bytes memory transactionId
    ) public whenNotPaused onlyRouterContract(msg.sender) returns (bool) {
        // (amount - txCost) * (serviceFee(%) * 1000) / (100(%) * 1000)
        uint256 serviceFeeInWTokens =
            amount.sub(txCost).mul(serviceFee).div(PRECISION);

        _distributeFees(serviceFeeInWTokens, txCost);

        uint256 amountToMint = amount.sub(txCost).sub(serviceFeeInWTokens);
        wrappedToken.mint(receiver, amountToMint);
        emit Mint(receiver, amount, txCost, transactionId);

        return true;
    }

    /**
     * @notice Burns `amount` WrappedTokens from `msg.sender`, distributes fees
     * and emits Burn event initiating the bridging of the tokens
     * @param amount The amount of WrappedTokens to be bridged
     * @param receiver The Hedera account to receive the HBARs
     */
    function burn(
        address from,
        uint256 amount,
        bytes memory receiver
    ) public whenNotPaused onlyRouterContract(msg.sender) returns (bool) {
        uint256 serviceFeeInWTokens = amount.mul(serviceFee).div(PRECISION);

        _distributeFees(serviceFeeInWTokens);

        wrappedToken.burnFrom(from, amount);
        uint256 bridgedAmount = amount.sub(serviceFeeInWTokens);

        emit Burn(from, bridgedAmount, serviceFeeInWTokens, receiver);
        return true;
    }

    /**
     * @notice Modifies the service fee
     * @param _serviceFee The new service fee
     */
    function setServiceFee(uint256 _serviceFee)
        public
        onlyValidServiceFee(_serviceFee)
        onlyOwner()
    {
        serviceFee = _serviceFee;
        emit ServiceFeeSet(msg.sender, _serviceFee);
    }

    /**
     * @notice Claims an amount of accrued fees to msg.sender
     * @param _amount The target amount
     */
    function claim(uint256 _amount) public {
        _createNewCheckpoint();

        require(
            _amount > 0 && _amount <= claimableFees[msg.sender],
            "Bridge: msg.sender has nothing to claim"
        );
        claimableFees[msg.sender] = claimableFees[msg.sender].sub(_amount);

        if (!paused()) {
            wrappedToken.mint(msg.sender, _amount);
        } else {
            wrappedToken.transfer(msg.sender, _amount);
        }
        totalClaimableFees = totalClaimableFees.sub(_amount);
        emit Claim(msg.sender, _amount);
    }

    /// @notice Deprecates the contract. The outstanding, non-claimed fees are minted to the bridge contract for members to claim
    function deprecate() public onlyRouterContract(msg.sender) returns (bool) {
        wrappedToken.mint(address(this), totalClaimableFees);
        _pause();
        emit Deprecate(msg.sender, totalClaimableFees);
        return true;
    }

    /// @notice Updates the accrued fees based on service and tx fees
    function _distributeFees(uint256 _serviceFeeInWTokens, uint256 _txFee)
        private
    {
        totalClaimableFees = totalClaimableFees.add(_serviceFeeInWTokens).add(
            _txFee
        );
        _addServiceFeeReward(_serviceFeeInWTokens);

        claimableFees[msg.sender] = claimableFees[msg.sender].add(_txFee);
    }

    /// @notice Updates the accrued fees based on service fee
    function _distributeFees(uint256 _serviceFeeInWTokens) private {
        totalClaimableFees = totalClaimableFees.add(_serviceFeeInWTokens);
        _addServiceFeeReward(_serviceFeeInWTokens);
    }

    /// @notice Adds a service fee reward to the latest checkpoint
    function _addServiceFeeReward(uint256 _serviceFeeReward) private {
        checkpointServiceFeesAccrued[
            totalCheckpoints
        ] = checkpointServiceFeesAccrued[totalCheckpoints].add(
            _serviceFeeReward
        );
    }

    /// @notice Allows _createNewCheckpoint() to be called from router
    function createNewCheckpoint()
        public
        onlyRouterContract(msg.sender)
        returns (bool)
    {
        _createNewCheckpoint();
        return true;
    }
}
