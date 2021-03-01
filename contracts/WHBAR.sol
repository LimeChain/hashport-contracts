pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";

/**
 *  @author LimeChain Dev team
 *  @title ERC20 WHBAR contract
 */
contract WHBAR is ERC20Pausable, Ownable {
    /// @notice The controller address of the contract
    address public controllerAddress;

    /// @notice An event emitted once the controller address is changed
    event SetControllerAddress(address newControllerAddress);

    /**
     *  @notice Construct a new WHBAR contract
     *  @param tokenName The EIP-20 token name
     *  @param tokenSymbol The EIP-20 token symbol
     */
    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals
    ) public ERC20(tokenName, tokenSymbol) {
        super._setupDecimals(decimals);
    }

    /// @notice Allows only controller contract for msg.sender
    modifier onlyControllerContract() {
        require(
            msg.sender == controllerAddress,
            "WHBAR: Not called by the controller contract"
        );
        _;
    }

    /**
     * @notice Mints `amount` of tokens to the `account` address
     * @param account The address to which the tokens will be minted
     * @param amount The amount to be minted
     */
    function mint(address account, uint256 amount)
        public
        onlyControllerContract
    {
        super._mint(account, amount);
    }

    /**
     * @notice Burns `amount` of tokens from the `account` address
     * @param account The address from which the tokens will be burned
     * @param amount The amount to be burned
     */
    function burnFrom(address account, uint256 amount)
        public
        onlyControllerContract
    {
        uint256 decreasedAllowance =
            allowance(account, _msgSender()).sub(
                amount,
                "ERC20: burn amount exceeds allowance"
            );

        _approve(account, _msgSender(), decreasedAllowance);
        _burn(account, amount);
    }

    /// @notice Pauses the contract
    function pause() public onlyOwner {
        super._pause();
    }

    /// @notice Unpauses the contract
    function unpause() public onlyOwner {
        super._unpause();
    }

    /// @notice Changes the controller address
    function setControllerAddress(address _controllerAddress) public onlyOwner {
        require(_controllerAddress != address(0));
        controllerAddress = _controllerAddress;
        emit SetControllerAddress(controllerAddress);
    }
}
