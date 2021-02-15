pragma solidity 0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";

contract WHBAR is ERC20Pausable, Ownable {
    address public controllerAddress;

    event SetBridgeAddress(address newBridgeAddress);

    modifier onlyBridgeContract() {
        require(
            msg.sender == controllerAddress,
            "WHBAR: Not called by the controller contract"
        );
        _;
    }

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals
    ) public ERC20(tokenName, tokenSymbol) {
        super._setupDecimals(decimals);
    }

    function mint(address account, uint256 amount) public onlyBridgeContract {
        super._mint(account, amount);
    }

    function burnFrom(address account, uint256 amount)
        public
        onlyBridgeContract
    {
        uint256 decreasedAllowance =
            allowance(account, _msgSender()).sub(
                amount,
                "ERC20: burn amount exceeds allowance"
            );

        _approve(account, _msgSender(), decreasedAllowance);
        _burn(account, amount);
    }

    function pause() public onlyOwner {
        super._pause();
    }

    function unpause() public onlyOwner {
        super._unpause();
    }

    function setBridgeContractAddress(address _controllerAddress)
        public
        onlyOwner
    {
        require(_controllerAddress != address(0));
        controllerAddress = _controllerAddress;
        emit SetBridgeAddress(controllerAddress);
    }
}
