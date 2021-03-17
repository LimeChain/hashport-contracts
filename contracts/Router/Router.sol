pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../Interfaces/IController.sol";
import "../Governance.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract Router is Governance {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Iterable set of controller contracts
    EnumerableSet.AddressSet private controllersSet;

    /// @notice Struct containing necessary metadata for a given transaction
    struct Transaction {
        bool isExecuted;
        mapping(address => bool) signatures;
    }

    /// @notice Storage metadata for hedera -> eth transactions. Key bytes represents Hedera TransactionID
    mapping(bytes => Transaction) public mintTransfers;

    /// @notice An event emitted once controller contract is set
    event ControllerContractSet(address newController, bool isActive);

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

    /**
     * @notice Mints `amount - fees` WHBARs to the `receiver` address. Must be authorised by `signatures` from the `members` set
     * @param transactionId The Hedera Transaction ID
     * @param controller The corresponding controller contract
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param txCost The amount of WHBARs reimbursed to `msg.sender`
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function mintWithReimbursement(
        bytes memory transactionId,
        address controller,
        address receiver,
        uint256 amount,
        uint256 txCost,
        bytes[] memory signatures
    )
        public
        onlyValidTxId(transactionId)
        onlyMember
        onlyValidSignatures(signatures.length)
    {
        bytes32 ethHash =
            _computeMessage(
                transactionId,
                controller,
                receiver,
                amount,
                txCost,
                tx.gasprice
            );

        _mint(
            transactionId,
            ethHash,
            controller,
            receiver,
            amount,
            txCost,
            signatures
        );
    }

    /**
     * @notice Mints `amount - fees` WHBARs to the `receiver` address. Must be authorised by `signatures` from the `members` set
     * @param transactionId The Hedera Transaction ID
     * @param controller The corresponding controller contract
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function mint(
        bytes memory transactionId,
        address controller,
        address receiver,
        uint256 amount,
        bytes[] memory signatures
    )
        public
        onlyValidTxId(transactionId)
        onlyValidSignatures(signatures.length)
    {
        bytes32 ethHash =
            _computeMessage(transactionId, controller, receiver, amount);

        _mint(
            transactionId,
            ethHash,
            controller,
            receiver,
            amount,
            0,
            signatures
        );
    }

    /**
     * @notice _mint calls mint on the controller contract
     * @param transactionId The Hedera Transaction ID
     * @param ethHash The hashed data
     * @param controller The corresponding controller contract
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param txCost The amount of WHBARs reimbursed to `msg.sender`
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function _mint(
        bytes memory transactionId,
        bytes32 ethHash,
        address controller,
        address receiver,
        uint256 amount,
        uint256 txCost,
        bytes[] memory signatures
    ) private {
        require(
            controllersSet.contains(controller),
            "Router: controller contract not active"
        );

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

        require(
            IController(controller).mint(
                receiver,
                amount,
                txCost,
                transactionId,
                msg.sender
            ),
            "Router: Failed to mint tokens"
        );
    }

    /**
     * @notice call burn of the given controller contract `amount` WHBARs from `msg.sender`, distributes fees
     * @param amount The amount of WHBARs to be bridged
     * @param receiver The Hedera account to receive the HBARs
     * @param controller contract The corresponding controller contract
     */
    function burn(
        uint256 amount,
        bytes memory receiver,
        address controller
    ) public {
        require(
            controllersSet.contains(controller),
            "Router: invalid controller address"
        );
        require(receiver.length > 0, "Router: invalid receiver value");
        require(
            IController(controller).burn(msg.sender, amount, receiver),
            "Router: Failed to burn tokens"
        );
    }

    /**
     * @notice Adds/removes a member account. Not idempotent
     * call createNewCheckpoint() for all linked controller contracts
     * @param account The account to be modified
     * @param isMember Whether the account will be set as member or not
     */
    function updateMember(address account, bool isMember) public onlyOwner {
        for (uint256 i = 0; i < controllersSet.length(); i++) {
            require(
                IController(controllersSet.at(i)).createNewCheckpoint(),
                "Router: Failed to create checkpoint"
            );
        }
        _updateMember(account, isMember);
    }

    /**
     * @notice Adds/Removes Controller contracts
     * @param newController The address of the controller contract
     * @param isActive Shows the status of the contract
     */
    function setControllerContract(address newController, bool isActive)
        public
        onlyOwner
    {
        require(newController != address(0));
        if (isActive) {
            require(
                controllersSet.add(newController),
                "Router: Failed to add controller contract"
            );
        } else {
            require(
                controllersSet.remove(newController),
                "Router: Failed to remove controller contract"
            );
        }

        emit ControllerContractSet(newController, isActive);
    }

    /// @notice Deprecates the contract. The outstanding, non-claimed fees are minted to the controller contract for members to claim
    function deprecate(address controller) public onlyOwner {
        require(
            IController(controller).deprecate(),
            "Router: Failed to depecate controller"
        );
    }

    /// @notice Returns true/false depending on whether a given address is active controller or not
    function isController(address controller) public view returns (bool) {
        return controllersSet.contains(controller);
    }

    /// @notice Returns the count of the controllers
    function controllersCount() public view returns (uint256) {
        return controllersSet.length();
    }

    /// @notice Returns the address of a controller at a given index
    function controllerAt(uint256 index) public view returns (address) {
        return controllersSet.at(index);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the signature
    function _computeMessage(
        bytes memory transactionId,
        address controller,
        address receiver,
        uint256 amount
    ) private pure returns (bytes32) {
        bytes32 hashedData =
            keccak256(abi.encode(transactionId, controller, receiver, amount));
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the signature with txCost and gascost
    function _computeMessage(
        bytes memory transactionId,
        address controller,
        address receiver,
        uint256 amount,
        uint256 txCost,
        uint256 gascost
    ) private pure returns (bytes32) {
        bytes32 hashedData =
            keccak256(
                abi.encode(
                    transactionId,
                    controller,
                    receiver,
                    amount,
                    txCost,
                    gascost
                )
            );
        return ECDSA.toEthSignedMessageHash(hashedData);
    }
}
