pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../Interfaces/IBridge.sol";
import "../Governance.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract BridgeRouter is Governance {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Iterable set of bridge contracts
    EnumerableSet.AddressSet private bridgesSet;

    /// @notice Storage metadata for hedera -> eth transactions. Key bytes represents Hedera TransactionID
    mapping(bytes => Transaction) public mintTransfers;

    /// @notice Accepts number of signatures in the range (n/2; n] where n is the number of members
    modifier onlyValidSignatures(uint256 n) {
        uint256 members = membersCount();
        require(n <= members, "Bridge: Invalid number of signatures");
        require(n > members / 2, "Bridge: Invalid number of signatures");
        _;
    }
    /// @notice Accepts only non-executed transactions
    modifier onlyValidTxId(bytes memory txId) {
        require(
            !mintTransfers[txId].isExecuted,
            "Bridge: txId already submitted"
        );
        _;
    }

    /// @notice Struct containing necessary metadata for a given transaction
    struct Transaction {
        bool isExecuted;
        mapping(address => bool) signatures;
    }

    /**
     * @notice Mints `amount - fees` WHBARs to the `receiver` address. Must be authorised by `signatures` from the `members` set
     * @param transactionId The Hedera Transaction ID
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param txCost The amount of WHBARs reimbursed to `msg.sender`
     * @param signatures The array of signatures from the members, authorising the operation
     * @param bridgeContract The coresponding bridge contract
     */
    function mint(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 txCost,
        bytes[] memory signatures,
        address bridgeContract
    )
        public
        onlyValidTxId(transactionId)
        onlyMember
        onlyValidSignatures(signatures.length)
    {
        require(bridgesSet.contains(bridgeContract));
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

        require(
            IBridge(bridgeContract).mint(
                receiver,
                amount,
                txCost,
                transactionId
            )
        );
    }

    /**
     * @notice call burn of the given bridgeContract `amount` WHBARs from `msg.sender`, distributes fees
     * @param amount The amount of WHBARs to be bridged
     * @param receiver The Hedera account to receive the HBARs
     * @param bridgeContract The coresponding bridge contract
     */
    function burn(
        uint256 amount,
        bytes memory receiver,
        address bridgeContract
    ) public {
        require(
            bridgesSet.contains(bridgeContract),
            "BridgeRouter: invalid bridge address"
        );
        require(receiver.length > 0, "BridgeRouter: invalid receiver value");
        require(IBridge(bridgeContract).burn(msg.sender, amount, receiver));
    }

    /**
     * @notice Adds/removes a member account. Not idempotent
     * call createNewCheckpoint() for all linked bridge contracts
     * @param account The account to be modified
     * @param isMember Whether the account will be set as member or not
     */
    function updateMember(address account, bool isMember) public onlyOwner {
        for (uint256 i = 0; i < bridgesSet.length(); i++) {
            require(IBridge(bridgesSet.at(i)).createNewCheckpoint());
        }
        _updateMember(account, isMember);
    }

    /**
     * @notice Adds/Removes Bridge contracts
     * @param newBridge The address of the bridge contract
     */
    function setBridgeContract(address newBridge, bool isActive)
        public
        onlyOwner
    {
        require(newBridge != address(0));
        if (isActive) {
            require(bridgesSet.add(newBridge));
        } else {
            require(bridgesSet.remove(newBridge));
        }
    }

    /// @notice Deprecates the contract. The outstanding, non-claimed fees are minted to the bridge contract for members to claim
    function deprecate(address bridgeContract) public onlyOwner {
        require(IBridge(bridgeContract).deprecate());
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
