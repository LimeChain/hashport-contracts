pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "./WHBAR.sol";
import "./Custodians.sol";

contract Bridge is Custodians, Pausable {
    using SafeMath for uint256;

    WHBAR public whbarToken;

    // NOTE: value of serviceFee should be in range 0% to 99.999% multiplied my 1000
    uint256 public serviceFee;

    mapping(bytes => Transaction) public mintTransfers;

    struct Transaction {
        bool isExecuted;
        mapping(address => bool) signatures;
    }

    modifier onlyValidTxId(bytes memory txId) {
        require(
            !mintTransfers[txId].isExecuted,
            "Bridge: txId already submitted"
        );
        _;
    }

    modifier onyValidServiceFee(uint256 _serviceFee) {
        require(_serviceFee < 100000, "Bridge: Service fee cannot exceed 100%");
        _;
    }

    modifier onlyValidSignaturesLength(uint256 length) {
        require(length <= custodianCount(), "Bridge: Invalid custodians count");
        require(length > custodianCount() / 2, "Bridge: Invalid confirmations");
        _;
    }

    event Mint(
        address account,
        uint256 amount,
        uint256 txCost,
        bytes transactionId
    );
    event Burn(address account, uint256 amount, bytes receiverAddress);
    event ServiceFeeSet(uint256 newServiceFee);
    event Withdraw(address account, uint256 amount);

    constructor(address _whbarToken, uint256 _serviceFee) public {
        whbarToken = WHBAR(_whbarToken);
        serviceFee = _serviceFee;
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
        whenNotPaused
    {
        require(
            containsCustodian(msg.sender),
            "Bridge: msg.sender is not a custodian"
        );
        bytes32 hashedData = getHash(transactionId, receiver, amount, txCost);

        Transaction storage transaction = mintTransfers[transactionId];

        for (uint256 i = 0; i < signatures.length; i++) {
            bytes32 ethHash = ECDSA.toEthSignedMessageHash(hashedData);
            address signer = ECDSA.recover(ethHash, signatures[i]);
            require(containsCustodian(signer), "Bridge: invalid signer");
            require(
                !transaction.signatures[signer],
                "Bridge: signature already set"
            );
            transaction.signatures[signer] = true;
        }
        transaction.isExecuted = true;

        // amount * (serviceFee * 1000) / (100(%) * 1000)
        uint256 serviceFeeInWhbar = amount.mul(serviceFee).div(100000);

        _distributeFees(amount, serviceFeeInWhbar, txCost);

        uint256 amountToMint = amount.sub(txCost).sub(serviceFeeInWhbar);
        whbarToken.mint(receiver, amountToMint);

        emit Mint(receiver, amountToMint, txCost, transactionId);
    }

    function burn(uint256 amount, bytes memory receiverAddress) public {
        require(
            receiverAddress.length > 0,
            "Bridge: invalid receiverAddress value"
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

    function withdraw() public {
        require(
            custodiansToAmount[msg.sender] > 0,
            "Bridge: msg.sender has nothing to withdraw"
        );
        uint256 amountToMint = custodiansToAmount[msg.sender];
        custodiansToAmount[msg.sender] = 0;

        if (!paused()) {
            whbarToken.mint(msg.sender, amountToMint);
        } else {
            whbarToken.transfer(msg.sender, amountToMint);
        }
        custodiansTotalAmount = custodiansTotalAmount.sub(amountToMint);
        Withdraw(msg.sender, amountToMint);
    }

    function depricate() public onlyOwner {
        whbarToken.mint(address(this), custodiansTotalAmount);
        _pause();
    }

    function _distributeFees(
        uint256 _totalAmount,
        uint256 _serviceFeeInWhbar,
        uint256 _txCost
    ) private {
        custodiansTotalAmount = custodiansTotalAmount.add(_totalAmount).add(
            _txCost
        );

        uint256 serviceFeePerSigner = _serviceFeeInWhbar.div(custodianCount());

        for (uint256 i = 0; i < custodianCount(); i++) {
            custodiansToAmount[custodianAddress(i)] = custodiansToAmount[
                custodianAddress(i)
            ]
                .add(serviceFeePerSigner);
        }

        custodiansToAmount[msg.sender] = custodiansToAmount[msg.sender].add(
            _txCost
        );
    }
}
