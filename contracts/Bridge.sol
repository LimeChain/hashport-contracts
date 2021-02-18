pragma solidity 0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "./WHBAR.sol";
import "./Governance.sol";

/**
 *  @author LimeChain Dev team
 *  @title HBAR Bridge Contract
 */
contract Bridge is Governance, Pausable {
    using SafeMath for uint256;

    /// @notice The configured WHBAR token
    WHBAR public whbarToken;

    /// @notice Value of the service fee in percentage. Range 0% to 99.999% multiplied my 1000
    uint256 public serviceFee;

    /// @notice Precision of the service fee
    uint256 constant PRECISION = 100000;

    /// @notice Storage metadata for hedera -> eth transactions. Key bytes represents Hedera TransactionID
    mapping(bytes => Transaction) public mintTransfers;

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
    event Burn(address indexed account, uint256 amount, bytes indexed receiver);

    /// @notice An event emitted once the service fee is modified
    event ServiceFeeSet(address account, uint256 newServiceFee);

    /// @notice An event emitted once Member claims fees accredited to him
    event Claim(address indexed account, uint256 amount);

    /// @notice An event emitted once this contract is deprecated by the owner
    event Deprecate(address account, uint256 amount);

    /**
     *  @notice Construct a new Bridge contract
     *  @param _whbarToken The address of the ERC20 WHBAR token
     *  @param _serviceFee The initial service fee
     */
    constructor(address _whbarToken, uint256 _serviceFee) public {
        whbarToken = WHBAR(_whbarToken);
        serviceFee = _serviceFee;
    }

    /// @notice Accepts only non-executed transactions
    modifier onlyValidTxId(bytes memory txId) {
        require(
            !mintTransfers[txId].isExecuted,
            "Bridge: txId already submitted"
        );
        _;
    }

    /// @notice Accepts only service fee between 0 and PRECISION
    modifier onyValidServiceFee(uint256 _serviceFee) {
        require(
            _serviceFee < PRECISION,
            "Bridge: Service fee cannot exceed 100%"
        );
        _;
    }

    /// @notice Accepts number of signatures in the range (n/2; n] where n is the number of members
    modifier onlyValidSignatures(uint256 n) {
        uint256 members = membersCount();
        require(n <= members, "Bridge: Invalid number of signatures");
        require(n > members / 2, "Bridge: Invalid number of signatures");
        _;
    }

    /**
     * @notice Mints `amount - fees` WHBARs to the `receiver` address. Must be authorised by `signatures` from the `members` set
     * @param transactionId The Hedera Transaction ID
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param txCost The amount of WHBARs reimbursed to `msg.sender`
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function mint(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 txCost,
        bytes[] memory signatures
    )
        public
        whenNotPaused
        onlyValidTxId(transactionId)
        onlyMember
        onlyValidSignatures(signatures.length)
    {
        bytes32 ethHash =
            computeMessage(transactionId, receiver, amount, txCost);

        Transaction storage transaction = mintTransfers[transactionId];

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(ethHash, signatures[i]);
            require(isMember(signer), "Bridge: invalid signer");
            require(
                !transaction.signatures[signer],
                "Bridge: signature already set"
            );
            transaction.signatures[signer] = true;
        }
        transaction.isExecuted = true;

        // (amount - txCost) * (serviceFee(%) * 1000) / (100(%) * 1000)
        uint256 serviceFeeInWhbar =
            (amount.sub(txCost)).mul(serviceFee).div(PRECISION);

        _distributeFees(serviceFeeInWhbar, txCost);

        uint256 amountToMint = amount.sub(txCost).sub(serviceFeeInWhbar);
        whbarToken.mint(receiver, amountToMint);

        emit Mint(receiver, amountToMint, txCost, transactionId);
    }

    /**
     * @notice Burns `amount` WHBARs from `msg.sender`, distributes fees
     * and emits Burn event initiating the bridging of the tokens
     * @param amount The amount of WHBARs to be bridged
     * @param receiver The Hedera account to receive the HBARs
     */
    function burn(uint256 amount, bytes memory receiver) public whenNotPaused {
        require(receiver.length > 0, "Bridge: invalid receiver value");

        uint256 serviceFeeInWhbar = amount.mul(serviceFee).div(PRECISION);

        _distributeFees(serviceFeeInWhbar);

        whbarToken.burnFrom(msg.sender, amount);

        emit Burn(msg.sender, amount, receiver);
    }

    /**
     * @notice Modifies the service fee
     * @param _serviceFee The new service fee
     */
    function setServiceFee(uint256 _serviceFee)
        public
        onyValidServiceFee(_serviceFee)
        onlyOwner
    {
        serviceFee = _serviceFee;
        emit ServiceFeeSet(msg.sender, _serviceFee);
    }

    /// @notice Claims the accrued fees of a member
    function claim() public {
        require(
            claimableFees[msg.sender] > 0,
            "Bridge: msg.sender has nothing to claim"
        );
        uint256 amountToMint = claimableFees[msg.sender];
        claimableFees[msg.sender] = 0;

        if (!paused()) {
            whbarToken.mint(msg.sender, amountToMint);
        } else {
            whbarToken.transfer(msg.sender, amountToMint);
        }
        totalClaimableFees = totalClaimableFees.sub(amountToMint);
        emit Claim(msg.sender, amountToMint);
    }

    /// @notice Deprecates the contract. The outstanding, non-claimed fees are minted to the bridge contract for members to claim
    function deprecate() public onlyOwner {
        whbarToken.mint(address(this), totalClaimableFees);
        _pause();
        emit Deprecate(msg.sender, totalClaimableFees);
    }

    /// @notice Updates the accrued fees of members based on service and tx fees
    function _distributeFees(uint256 _serviceFeeInWhbar, uint256 _txFee)
        private
    {
        totalClaimableFees = totalClaimableFees.add(_serviceFeeInWhbar).add(
            _txFee
        );

        _setMembersRewards(_serviceFeeInWhbar);

        claimableFees[msg.sender] = claimableFees[msg.sender].add(_txFee);
    }

    /// @notice Updates the accrued fees of members based on service fee
    function _distributeFees(uint256 _serviceFeeInWhbar) private {
        totalClaimableFees = totalClaimableFees.add(_serviceFeeInWhbar);
        _setMembersRewards(_serviceFeeInWhbar);
    }

    /// @notice Increments all members rewards the new service and tx fees
    function _setMembersRewards(uint256 _serviceFeeInWhbar) private {
        uint256 serviceFeePerSigner = _serviceFeeInWhbar.div(membersCount());

        for (uint256 i = 0; i < membersCount(); i++) {
            address currentMember = memberAt(i);
            claimableFees[currentMember] = claimableFees[currentMember].add(
                serviceFeePerSigner
            );
        }
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the signature
    function computeMessage(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 txCost
    ) private pure returns (bytes32) {
        bytes32 hashedData =
            keccak256(abi.encode(transactionId, receiver, amount, txCost));
        return ECDSA.toEthSignedMessageHash(hashedData);
    }
}
