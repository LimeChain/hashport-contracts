pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";

/**
 *  @author LimeChain Dev team
 *  @title ERC20 WrappedToken contract
 */
contract WrappedToken is ERC20Pausable, Ownable {
    /// @notice The address of the controller contract
    address public controller;

    /// @notice An event emitted once the controller address is changed
    event ControllerSet(address indexed newController);

    /// @notice Allows only router contract for msg.sender
    modifier onlyController() {
        require(
            msg.sender == controller,
            "WrappedToken: Not called by the controller contract"
        );
        _;
    }

    /**
     *  @notice Construct a new WrappedToken contract
     *  @param tokenName The EIP-20 token name
     *  @param tokenSymbol The EIP-20 token symbol
     */
    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals,
        address _controller
    ) public ERC20(tokenName, tokenSymbol) {
        require(
            _controller != address(0),
            "WrappedToken: controller address cannot be zero"
        );
        super._setupDecimals(decimals);
        controller = _controller;
    }

    /**
     * @notice Mints `amount` of tokens to the `account` address
     * @param account The address to which the tokens will be minted
     * @param amount The amount to be minted
     */
    function mint(address account, uint256 amount) public onlyController {
        super._mint(account, amount);
    }

    /**
     * @notice Burns `amount` of tokens from the `account` address
     * @param account The address from which the tokens will be burned
     * @param amount The amount to be burned
     */
    function burnFrom(address account, uint256 amount) public onlyController {
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
    function setController(address _controller) public onlyOwner {
        require(
            _controller != address(0),
            "WrappedToken: controller cannot be zero"
        );
        controller = _controller;

        emit ControllerSet(controller);
    }
}
