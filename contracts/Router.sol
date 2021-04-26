// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./Governance.sol";

import "./Interfaces/IController.sol";
import "./Interfaces/IWrappedToken.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract Router is Governance {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice The address of the controller contract
    address public controller;

    /// @dev Iterable set of wrappedToken contracts
    EnumerableSet.AddressSet private wrappedAssets;

    /// @notice Hedera native to wrapped asset address
    mapping(bytes => address) public nativeToWrapped;

    /// @notice Wrapped to Hedera native asset
    mapping(address => bytes) public wrappedToNative;

    /// @notice Storage metadata for Transfers. The Key bytes represent Hedera TransactionID
    mapping(bytes => bool) public executedTransactions;

    /// @notice An event emitted once new pair of assets are added
    event PairAdded(bytes native, address wrapped);

    /// @notice An event emitted once pair of assets are removed
    event PairRemoved(bytes native, address wrapped);

    /// @notice An event emitted once a Mint transaction is executed
    event Mint(
        address indexed account,
        address indexed wrappedAsset,
        uint256 amount,
        bytes indexed transactionId
    );

    /// @notice An event emitted once a Burn transaction is executed
    event Burn(
        address indexed account,
        address indexed wrappedAsset,
        uint256 amount,
        bytes receiver
    );

    /**
     *  @notice Passes an argument for constructing a new FeeCalculator contract
     *  @param _controller The address of the controler contract
     */
    constructor(address _controller) {
        require(
            _controller != address(0),
            "Router: controller address cannot be zero"
        );
        controller = _controller;
    }

    /// @notice Accepts number of signatures in the range (n/2; n] where n is the number of members
    modifier validSignatureCount(uint256 n) {
        uint256 members = membersCount();
        require(n <= members, "Router: Invalid number of signatures");
        require(n > members / 2, "Router: Invalid number of signatures");
        _;
    }

    /// @notice Accepts only non-executed transactions
    modifier validTxId(bytes memory txId) {
        require(!executedTransactions[txId], "Router: txId already submitted");
        _;
    }

    /// @notice Require the wrappedToken address to be an existing one
    modifier supportedAsset(address token) {
        require(isSupportedAsset(token), "Router: token not supported");
        _;
    }

    /// @notice Require non-empty native and non-zero address wrapped asset values
    modifier validPair(bytes memory nativeAsset, address wrappedAsset) {
        require(nativeAsset.length > 0, "Router: invalid native asset");
        require(wrappedAsset != address(0), "Router: address can't be zero");
        _;
    }

    /**
     * @notice Mints `amount` wrapped tokens to the `receiver` address. Must be authorised by a supermajority of `signatures` from the `members` set
     * @param transactionId The Hedera Transaction ID
     * @param wrappedAsset The corresponding wrappedToken contract
     * @param receiver The address receiving the tokens
     * @param amount The desired minting amount
     * @param signatures The array of signatures from the members, authorising the operation
     */
    function mint(
        bytes memory transactionId,
        address wrappedAsset,
        address receiver,
        uint256 amount,
        bytes[] memory signatures
    )
        public
        validTxId(transactionId)
        validSignatureCount(signatures.length)
        supportedAsset(wrappedAsset)
    {
        bytes32 ethHash =
            computeMessage(
                transactionId,
                address(this),
                wrappedAsset,
                receiver,
                amount
            );

        validateAndStoreTx(transactionId, ethHash, signatures);

        IController(controller).mint(wrappedAsset, receiver, amount);
        emit Mint(receiver, wrappedAsset, amount, transactionId);
    }

    /**
     * @notice Burns the provided `amount` of wrapped tokens and emits Burn event
     * @param amount The amount of wrapped tokens to be bridged
     * @param receiver The Hedera account to receive the wrapped tokens
     * @param wrappedAsset The corresponding wrapped asset contract
     */
    function burn(
        uint256 amount,
        bytes memory receiver,
        address wrappedAsset
    ) public supportedAsset(wrappedAsset) {
        require(receiver.length > 0, "Router: invalid receiver value");

        IController(controller).burnFrom(wrappedAsset, msg.sender, amount);

        emit Burn(msg.sender, wrappedAsset, amount, receiver);
    }

    /**
     * @notice Approves and Burns the provided `amount` of wrapped tokens and emits Burn event
     * @param wrappedAsset The corresponding wrapped asset contract
     * @param receiver The Hedera account to receive the wrapped tokens
     * @param amount The amount of wrapped tokens to be bridged
     * @param deadline Timestamp of the deadline
     */
    function burnWithPermit(
        address wrappedAsset,
        bytes memory receiver,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public supportedAsset(wrappedAsset) {
        require(receiver.length > 0, "Router: invalid receiver value");

        IWrappedToken(wrappedAsset).permit(
            msg.sender,
            address(controller),
            amount,
            deadline,
            v,
            r,
            s
        );
        IController(controller).burnFrom(wrappedAsset, msg.sender, amount);

        emit Burn(msg.sender, wrappedAsset, amount, receiver);
    }

    /**
     * @notice Adds new pair of native and wrapped tokens to be supported for bridging
     * @param native The identifier of the Hedera native asset
     * @param wrapped The address of the wrapped token contract
     */
    function addPair(bytes memory native, address wrapped)
        public
        onlyOwner
        validPair(native, wrapped)
    {
        require(
            nativeToWrapped[native] == address(0),
            "Router: Native asset already added"
        );
        require(
            wrappedToNative[wrapped].length == 0,
            "Router: Wrapped asset already added"
        );

        require(wrappedAssets.add(wrapped), "Router: Token asset added");

        nativeToWrapped[native] = wrapped;
        wrappedToNative[wrapped] = native;
        emit PairAdded(native, wrapped);
    }

    /**
     * @notice Removes an already existing pair from the supported assets for bridging
     * @param native The identifier of the Hedera native asset
     * @param wrapped The address of the wrapped token contract
     */
    function removePair(bytes memory native, address wrapped) public onlyOwner {
        require(nativeToWrapped[native] == wrapped, "Router: Invalid pair");
        require(wrappedAssets.remove(wrapped), "Router: Invalid wrapped asset");

        bytes32 nativeFromStorage = keccak256(wrappedToNative[wrapped]);
        bytes32 nativeFromArgs = keccak256(native);
        require(nativeFromStorage == nativeFromArgs, "Router: Invalid pair");

        nativeToWrapped[native] = address(0);
        wrappedToNative[wrapped] = new bytes(0);
        emit PairRemoved(native, wrapped);
    }

    /// @notice Returns true/false depending on whether a given address is active wrappedToken or not
    function isSupportedAsset(address wrappedAsset) public view returns (bool) {
        return wrappedAssets.contains(wrappedAsset);
    }

    /// @notice Returns the count of the wrapped tokens
    function wrappedAssetsCount() public view returns (uint256) {
        return wrappedAssets.length();
    }

    /// @notice Returns the address of a wrappedToken at a given index
    function wrappedAssetAt(uint256 index) public view returns (address) {
        return wrappedAssets.at(index);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the signature
    function computeMessage(
        bytes memory transactionId,
        address router,
        address wrappedAsset,
        address receiver,
        uint256 amount
    ) private pure returns (bytes32) {
        bytes32 hashedData =
            keccak256(
                abi.encode(
                    transactionId,
                    router,
                    wrappedAsset,
                    receiver,
                    amount
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
        uint256 signersCount = signatures.length;
        address[] memory signers = new address[](signersCount);

        for (uint256 i = 0; i < signersCount; i++) {
            address signer = ECDSA.recover(ethHash, signatures[i]);
            require(isMember(signer), "Router: invalid signer");

            for (uint256 j = 0; j <= i; j++) {
                require(signers[j] != signer, "Router: signature already set");
            }

            signers[i] = signer;
        }
        executedTransactions[transactionId] = true;
    }

}
