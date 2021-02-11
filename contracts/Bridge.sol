pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "./WHBAR.sol";

contract Bridge is Ownable {
    using SafeMath for uint256;

    WHBAR public whbarToken;
    // NOTE: value of serviceFee should be in range 0% to 99.999% multiplied my 1000
    uint256 public serviceFee;

    uint256 public totalCustodians;
    mapping(address => bool) public custodians;

    mapping(bytes => Transaction) public mintTransfers;

    struct Transaction {
        bool isExecuted;
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

    modifier onyValidServiceFee(uint256 _serviceFee) {
        require(_serviceFee < 100000, "Service fee cannot exceed 100%");
        _;
    }

    event Mint(
        address account,
        uint256 amount,
        uint256 txCost,
        bytes transactionId
    );
    event Burn(address account, uint256 amount, bytes receiverAddress);
    event CustodianSet(address operator, bool status);
    event ServiceFeeSet(uint256 newServiceFee);

    constructor(address _whbarToken, uint256 _serviceFee) public {
        whbarToken = WHBAR(_whbarToken);
        serviceFee = _serviceFee;
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
        uint256 txCost,
        bytes[] memory signatures
    )
        public
        onlyValidSignaturesLength(signatures.length)
        onlyValidTxId(transactionId)
    {
        require(custodians[msg.sender], "mint: msg.sender is not a custodian");

        bytes32 hashedData = getHash(transactionId, receiver, amount, txCost);

        Transaction storage transaction = mintTransfers[transactionId];

        for (uint256 i = 0; i < signatures.length; i++) {
            bytes32 ethHash = ECDSA.toEthSignedMessageHash(hashedData);
            address signer = ECDSA.recover(ethHash, signatures[i]);
            require(custodians[signer], "mint: invalid signer");
            require(
                !transaction.signatures[signer],
                "mint: signature already set"
            );
            transaction.signatures[signer] = true; // costs ± 30k per signer
        }
        transaction.isExecuted = true;

        uint256 serviceFeeInWhbar = amount.mul(serviceFee).div(100000);
        uint256 amountToMint = amount.sub(txCost).sub(serviceFeeInWhbar);
        whbarToken.mint(receiver, amountToMint);

        // TODO: add the following values in mapping for every custodian
        // whbarToken.mint(msg.sender, txCost);
        // whbarToken.mint(/multisig wallet address/, fee);

        emit Mint(receiver, amountToMint, txCost, transactionId);
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
        uint256 txCost
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(transactionId, receiver, amount, txCost));
    }

    function setServiceFee(uint256 _serviceFee)
        public
        onyValidServiceFee(_serviceFee)
        onlyOwner
    {
        serviceFee = _serviceFee;
        ServiceFeeSet(_serviceFee);
    }
}
