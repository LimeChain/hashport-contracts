pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "./WHBAR.sol";

contract Bridge is Ownable {
    WHBAR public token;

    uint256 public totalOperators;
    mapping(address => bool) public operators;

    struct Tx {
        uint256 sigCounts;
        mapping(address => bool) signatures;
    }

    uint256 public mintTransfersCount;
    mapping(uint256 => Tx) public mintTransfers;
    mapping(bytes => bool) ids;

    modifier onlyNotOperator(address account) {
        require(operators[account] == false, "operator already set");
        _;
    }

    modifier onlyOperator(address account) {
        require(operators[account] == true, "operator already set");
        _;
    }

    modifier onlyValidSignaturesLength(uint256 length) {
        require(length <= totalOperators, "invalid operators length");
        require(length > (totalOperators / 2), "invalid count");
        _;
    }

    modifier onlyValidTxId(bytes memory txId) {
        require(ids[txId] == false, "txId already submitted");
        _;
    }

    event Burn(address account, uint256 amount, bytes receiverAddress);
    event Mint(address account, uint256 amount, bytes transactionId);

    constructor() internal {
        token = new WHBAR();
    }

    function setOperator(address account)
        public
        onlyOwner
        onlyNotOperator(account)
    {
        operators[account] = true;
        totalOperators++;
    }

    function removeOperator(address account)
        public
        onlyOwner
        onlyOperator(account)
    {
        operators[account] = false;
        totalOperators--;
    }

    function burn(uint256 amount, bytes memory receiverAddress) public {
        require(receiverAddress.length > 0, "invalid receiverAddress value");

        token.burn(msg.sender, amount);

        emit Burn(msg.sender, amount, receiverAddress);
    }

    function mint(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 fee,
        bytes[] memory signatures
    )
        public
        onlyValidSignaturesLength(signatures.length)
        onlyValidTxId(transactionId)
    {
        bytes32 hash = getHash(transactionId, receiver, amount, fee);

        Tx storage transfer = mintTransfers[mintTransfersCount];
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(hash, signatures[i]);
            require(operators[signer] == true, "invalid signer");
            require(
                transfer.signatures[signer] == false,
                "signature already set"
            );
            transfer.signatures[signer] = true;
        }
        token.mint(receiver, amount);
        ids[transactionId] = true;
        mintTransfersCount++;
        emit Mint(receiver, amount, transactionId);
    }

    function getHash(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 fee
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(transactionId, receiver, amount, fee));
    }
}
