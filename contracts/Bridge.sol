pragma solidity 0.6.0;
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

    uint256 constant precision = 100000;

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
        require(
            _serviceFee < precision,
            "Bridge: Service fee cannot exceed 100%"
        );
        _;
    }

    modifier onlyValidSignaturesLength(uint256 length) {
        require(length <= custodianCount(), "Bridge: Invalid custodians count");
        require(length > custodianCount() / 2, "Bridge: Invalid confirmations");
        _;
    }

    event Mint(
        address indexed account,
        uint256 amount,
        uint256 txCost,
        bytes indexed transactionId
    );
    event Burn(
        address indexed account,
        uint256 amount,
        bytes indexed receiverAddress
    );
    event ServiceFeeSet(address account, uint256 newServiceFee);
    event Withdraw(address indexed account, uint256 amount);
    event Deprecate(address account, uint256 amount);

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
        whenNotPaused
        onlyValidTxId(transactionId)
        onlyCustodian
        onlyValidSignaturesLength(signatures.length)
    {
        bytes32 ethHash =
            computeMessage(transactionId, receiver, amount, txCost);

        Transaction storage transaction = mintTransfers[transactionId];

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(ethHash, signatures[i]);
            require(isCustodian(signer), "Bridge: invalid signer");
            require(
                !transaction.signatures[signer],
                "Bridge: signature already set"
            );
            transaction.signatures[signer] = true;
        }
        transaction.isExecuted = true;

        // (amount - txCost) * (serviceFee(%) * 1000) / (100(%) * 1000)
        uint256 serviceFeeInWhbar =
            (amount.sub(txCost)).mul(serviceFee).div(precision);

        _distributeFees(serviceFeeInWhbar, txCost);

        uint256 amountToMint = amount.sub(txCost).sub(serviceFeeInWhbar);
        whbarToken.mint(receiver, amountToMint);

        emit Mint(receiver, amountToMint, txCost, transactionId);
    }

    function burn(uint256 amount, bytes memory receiverAddress)
        public
        whenNotPaused
    {
        require(
            receiverAddress.length > 0,
            "Bridge: invalid receiverAddress value"
        );

        uint256 serviceFeeInWhbar = amount.mul(serviceFee).div(precision);

        _distributeFees(serviceFeeInWhbar);

        whbarToken.burnFrom(msg.sender, amount);

        emit Burn(msg.sender, amount, receiverAddress);
    }

    function computeMessage(
        bytes memory transactionId,
        address receiver,
        uint256 amount,
        uint256 txCost
    ) public pure returns (bytes32) {
        bytes32 hashedData =
            keccak256(abi.encode(transactionId, receiver, amount, txCost));
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    function setServiceFee(uint256 _serviceFee)
        public
        onyValidServiceFee(_serviceFee)
        onlyOwner
    {
        serviceFee = _serviceFee;
        emit ServiceFeeSet(msg.sender, _serviceFee);
    }

    function withdraw() public {
        require(
            feesAccrued[msg.sender] > 0,
            "Bridge: msg.sender has nothing to withdraw"
        );
        uint256 amountToMint = feesAccrued[msg.sender];
        feesAccrued[msg.sender] = 0;

        if (!paused()) {
            whbarToken.mint(msg.sender, amountToMint);
        } else {
            whbarToken.transfer(msg.sender, amountToMint);
        }
        totalFeesAccrued = totalFeesAccrued.sub(amountToMint);
        emit Withdraw(msg.sender, amountToMint);
    }

    function deprecate() public onlyOwner {
        whbarToken.mint(address(this), totalFeesAccrued);
        _pause();
        emit Deprecate(msg.sender, totalFeesAccrued);
    }

    function _distributeFees(uint256 _serviceFeeInWhbar, uint256 _txCost)
        private
    {
        totalFeesAccrued = totalFeesAccrued.add(_serviceFeeInWhbar).add(
            _txCost
        );

        _setCustodianRewards(_serviceFeeInWhbar);

        feesAccrued[msg.sender] = feesAccrued[msg.sender].add(_txCost);
    }

    function _distributeFees(uint256 _serviceFeeInWhbar) private {
        totalFeesAccrued = totalFeesAccrued.add(_serviceFeeInWhbar);
        _setCustodianRewards(_serviceFeeInWhbar);
    }

    function _setCustodianRewards(uint256 _serviceFeeInWhbar) private {
        uint256 serviceFeePerSigner = _serviceFeeInWhbar.div(custodianCount());

        for (uint256 i = 0; i < custodianCount(); i++) {
            address currentCustodian = custodianAddress(i);
            feesAccrued[currentCustodian] = feesAccrued[currentCustodian].add(
                serviceFeePerSigner
            );
        }
    }
}
