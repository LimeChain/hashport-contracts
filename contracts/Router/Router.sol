pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../Interfaces/IWrappedToken.sol";
import "../FeeCalculator.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract Router is FeeCalculator {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Iterable set of wrappedToken contracts
    EnumerableSet.AddressSet private wrappedTokens;

    /// @notice Storage metadata for hedera -> eth transactions. Key bytes represents Hedera TransactionID
    mapping(bytes => Transaction) public mintTransfers;

    /// @notice Storage hedera token id -> wrappedToken address.
    mapping(bytes => address) public nativeToWrappedToken;

    /// @notice Storage wrappedToken address -> hedera token id.
    mapping(address => bytes) public wrappedToNativeToken;

    /// @notice Struct containing necessary metadata for a given transaction
    struct Transaction {
        bool isExecuted;
        mapping(address => bool) signatures;
    }

    /// @notice An event emitted once wrappedToken contract is set
    event TokenUpdate(address newWrappedToken, bytes nativeToken, bool isActive);

    /// @notice An event emitted once a Mint transaction is executed
    event Mint(
        address indexed account,
        uint256 amount,
        uint256 serviceFeeInWTokens,
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

    /// @notice An event emitted once Member claims fees accredited to him
    event Claim(address indexed account, uint256 amount);

    /**
     *  @notice Passes an argument for constructing a new FeeCalculator contract
     *  @param _serviceFee The initial service fee in percentage. Range 0% to 99.999% multiplied my 1000.
     */
    constructor(uint256 _serviceFee) public FeeCalculator(_serviceFee) {}

    /// @notice Accepts number of signatures in the range (n/2; n] where n is the number of members
    modifier onlyValidSignatures(uint256 n) {
        uint256 members = membersCount();
        require(n <= members, "Router: Invalid number of signatures");
        require(n > members / 2, "Router: Invalid number of signatures");
        _;
    }

    /// @notice Accepts only non-executed transactions
    modifier onlyValidTxId(bytes memory txId) {
        require(
            !mintTransfers[txId].isExecuted,
            "Router: txId already submitted"
        );
        _;
    }

    /// @notice Require the wrappedToken address to be an existing one
    modifier supportedToken(address supportedToken) {
        require(
            isSupportedToken(supportedToken),
            "Router: wrappedToken contract not active"
        );
        _;
    }

    /**
     * @notice Mints `amount` wrapped tokens to the `receiver` address. Must be authorised by a supermajority of `signatures` from the `members` set. Distributes service fee to the members.
     * @param transactionId The Hedera Transaction ID
     * @param wrappedToken The corresponding wrappedToken contract
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function mint(
        bytes memory transactionId,
        address wrappedToken,
        address receiver,
        uint256 amount,
        bytes[] memory signatures
    )
        public
        onlyValidTxId(transactionId)
        onlyValidSignatures(signatures.length)
        supportedToken(wrappedToken)
    {
        bytes32 ethHash =
            _computeMessage(transactionId, wrappedToken, receiver, amount);

        validateAndStoreTx(transactionId, ethHash, signatures);

        uint256 serviceFeeInWTokens = amount.mul(serviceFee).div(PRECISION);

        distributeRewards(wrappedToken, serviceFeeInWTokens);

        uint256 amountToMint = amount.sub(serviceFeeInWTokens);

        IWrappedToken(wrappedToken).mint(receiver, amountToMint);
        emit Mint(receiver, amount, serviceFeeInWTokens, 0, transactionId);
    }

    /**
     * @notice Mints `amount - fees` wrapped tokens to the `receiver` address. Must be authorised by a supermajority of `signatures` from the `members` set. Distributes service fee to the members.
     * @param transactionId The Hedera Transaction ID
     * @param wrappedToken The corresponding wrappedToken contract
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param txCost The amount of wrapped tokens reimbursed to `msg.sender`
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function mintWithReimbursement(
        bytes memory transactionId,
        address wrappedToken,
        address receiver,
        uint256 amount,
        uint256 txCost,
        bytes[] memory signatures
    )
        public
        onlyValidTxId(transactionId)
        onlyMember
        onlyValidSignatures(signatures.length)
        supportedToken(wrappedToken)
    {
        bytes32 ethHash =
            _computeMessage(
                transactionId,
                wrappedToken,
                receiver,
                amount,
                txCost,
                tx.gasprice
            );

        validateAndStoreTx(transactionId, ethHash, signatures);

        uint256 serviceFeeInWTokens =
            amount.sub(txCost).mul(serviceFee).div(PRECISION);

        distributeRewards(wrappedToken, txCost, serviceFeeInWTokens, msg.sender);

        uint256 amountToMint = amount.sub(txCost).sub(serviceFeeInWTokens);

        IWrappedToken(wrappedToken).mint(receiver, amountToMint);
        emit Mint(receiver, amount, serviceFeeInWTokens, txCost, transactionId);
    }

    /**
     * @notice call burn of the given wrappedToken contract `amount` wrapped tokens from `msg.sender`, distributes fees
     * @param amount The amount of wrapped tokens to be bridged
     * @param receiver The Hedera account to receive the wrapped tokens
     * @param wrappedToken contract The corresponding wrappedToken contract
     */
    function burn(
        uint256 amount,
        bytes memory receiver,
        address wrappedToken
    ) public supportedToken(wrappedToken) {
        require(receiver.length > 0, "Router: invalid receiver value");

        uint256 serviceFeeInWTokens = amount.mul(serviceFee).div(PRECISION);

        distributeRewards(wrappedToken, serviceFeeInWTokens);

        IWrappedToken(wrappedToken).burnFrom(msg.sender, amount);
        uint256 bridgedAmount = amount.sub(serviceFeeInWTokens);

        emit Burn(msg.sender, bridgedAmount, serviceFeeInWTokens, receiver);
    }

    function claim(address wrappedToken) public onlyMember {
        uint256 claimableAmount = _claimWrappedToken(msg.sender, wrappedToken);
        IWrappedToken(wrappedToken).mint(msg.sender, claimableAmount);
        emit Claim(msg.sender, claimableAmount);
    }

    /**
     * @notice Adds/removes a member account. Not idempotent
     * @param account The account to be modified
     * @param isMember Whether the account will be set as member or not
     */
    function updateMember(address account, bool isMember) public onlyOwner {
        if (isMember) {
            for (uint256 i = 0; i < wrappedTokensCount(); i++) {
                addNewMember(account, wrappedTokenAt(i));
            }
        } else {
            for (uint256 i = 0; i < wrappedTokensCount(); i++) {
                uint256 claimableFees = _claimWrappedToken(account, wrappedTokenAt(i));

                IWrappedToken(wrappedTokenAt(i)).mint(account, claimableFees);
            }
        }
        _updateMember(account, isMember);
    }

    /**
     * @notice Adds/Removes wrappedToken contracts
     * @param newWrappedToken The address of the wrappedToken contract
     * @param tokenID The id of the hedera token
     * @param isActive Shows the status of the contract
     */
    function updateWrappedToken(
        address newWrappedToken,
        bytes memory tokenID,
        bool isActive
    ) public onlyOwner {
        require(newWrappedToken != address(0), "Router: wrappedToken address can't be zero");
        require(tokenID.length > 0, "Router: invalid tokenID value");
        if (isActive) {
            require(
                wrappedTokens.add(newWrappedToken),
                "Router: Failed to add wrappedToken contract"
            );
            nativeToWrappedToken[tokenID] = newWrappedToken;
            wrappedToNativeToken[newWrappedToken] = tokenID;
        } else {
            require(
                wrappedTokens.remove(newWrappedToken),
                "Router: Failed to remove wrappedToken contract"
            );
            for (uint256 i = 0; i < membersCount(); i++) {
                uint256 claimableAmount = _claimWrappedToken(memberAt(i), newWrappedToken);
                IWrappedToken(wrappedTokenAt(i)).mint(msg.sender, claimableAmount);
            }
        }

        emit TokenUpdate(newWrappedToken, tokenID, isActive);
    }

    /// @notice Returns true/false depending on whether a given address is active wrappedToken or not
    function isSupportedToken(address wrappedToken) public view returns (bool) {
        return wrappedTokens.contains(wrappedToken);
    }

    /// @notice Returns the count of the wrapped tokens
    function wrappedTokensCount() public view returns (uint256) {
        return wrappedTokens.length();
    }

    /// @notice Returns the address of a wrappedToken at a given index
    function wrappedTokenAt(uint256 index) public view returns (address) {
        return wrappedTokens.at(index);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the signature
    function _computeMessage(
        bytes memory transactionId,
        address wrappedToken,
        address receiver,
        uint256 amount
    ) private pure returns (bytes32) {
        bytes32 hashedData =
            keccak256(abi.encode(transactionId, wrappedToken, receiver, amount));
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the signature with txCost and gascost
    function _computeMessage(
        bytes memory transactionId,
        address wrappedToken,
        address receiver,
        uint256 amount,
        uint256 txCost,
        uint256 gascost
    ) private pure returns (bytes32) {
        bytes32 hashedData =
            keccak256(
                abi.encode(
                    transactionId,
                    wrappedToken,
                    receiver,
                    amount,
                    txCost,
                    gascost
                )
            );
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    /**
     * @notice validateAndStoreTx validates the signatures and the data and saves the transaction
     * @param transactionId The Hedera Transaction ID
     * @param ethHash The hashed data
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function validateAndStoreTx(
        bytes memory transactionId,
        bytes32 ethHash,
        bytes[] memory signatures
    ) private {
        Transaction storage transaction = mintTransfers[transactionId];

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(ethHash, signatures[i]);
            require(isMember(signer), "Router: invalid signer");
            require(
                !transaction.signatures[signer],
                "Router: signature already set"
            );
            transaction.signatures[signer] = true;
        }
        transaction.isExecuted = true;
    }
}
