pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "./WHBAR.sol";

contract Bridge is Ownable {
    using SafeMath for uint256;

    WHBAR public whbarToken;

    uint256 public totalCustodians;
    mapping(address => bool) public custodians;

    mapping(bytes => Transaction) public mintTransfers;

    struct Transaction {
        bool isExecuted;
        address receiver;
        uint256 amount;
        uint fee;
        uint txCost;
        mapping(address => bool) signatures;
    }

    modifier onlyValidSignaturesLength(uint256 length) {
        require(
            length <= totalCustodians,
            "onlyValidSignaturesLength: invalid custodians count"
        );
        require(
            length > (totalCustodians / 2),
            "onlyValidSignaturesLength: invalid confirmations"
        );
        _;
    }

    modifier onlyValidTxId(bytes memory txId) {
        require(
            !mintTransfers[txId].isExecuted,
            "onlyValidTxId: xId already submitted"
        );
        _;
    }

    event Mint(address account, uint256 amount, bytes transactionId);
    event Burn(address account, uint256 amount, bytes receiverAddress);
    event CustodianSet(address operator, bool status);

    constructor(address _whbarToken) public {
        whbarToken = WHBAR(_whbarToken);
    }

    function setCustodian(address account, bool isOperator) public onlyOwner {
        if (isOperator) {
            require(
                !custodians[account],
                "setCustodian: operator already exists"
            );
            totalCustodians++;
        } else if (!isOperator) {
            require(
                custodians[account],
                "setCustodian: operator did not exist"
            );
            totalCustodians--;
        }

        custodians[account] = isOperator;
        CustodianSet(account, isOperator);
    }

    function mint(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 fee,
        uint256 txCost,
        bytes[] memory signatures
    )
        public
        onlyValidSignaturesLength(signatures.length)
        onlyValidTxId(transactionId)
    {
        require(custodians[msg.sender], "mint: msg.sender is not a custodian");

        bytes32 hashedData =
            getHash(transactionId, receiver, amount, fee, txCost);

        Transaction storage transaction = mintTransfers[transactionId];

        for (uint256 i = 0; i < signatures.length; i++) {
            bytes32 ethHash = ECDSA.toEthSignedMessageHash(hashedData);
            address signer = ECDSA.recover(ethHash, signatures[i]);
            require(custodians[signer], "mint: invalid signer");
            require(
                !transaction.signatures[signer],
                "mint: signature already set"
            );
            transaction.signatures[signer] = true;
        }
        transaction.receiver = receiver;
        transaction.amount = amount;
        transaction.fee = fee;
        transaction.txCost = txCost;
        transaction.isExecuted = true;

        uint256 amountToMint = amount.sub(txCost).sub(fee);
        whbarToken.mint(receiver, amountToMint);
        whbarToken.mint(msg.sender, txCost);
        // TODO: ? mint the fee to the multisig wallet ?
        // whbarToken.mint(/multisig wallet address/, fee);

        emit Mint(receiver, amountToMint, transactionId);
    }

    function burn(uint256 amount, bytes memory receiverAddress) public {
        require(
            receiverAddress.length > 0,
            "burn: invalid receiverAddress value"
        );

        whbarToken.burn(msg.sender, amount);

        emit Burn(msg.sender, amount, receiverAddress);
    }

    function getHash(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 fee,
        uint256 txCost
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encode(transactionId, receiver, amount, fee, txCost));
    }
}
