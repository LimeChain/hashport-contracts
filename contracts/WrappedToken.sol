pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";

/**
 *  @author LimeChain Dev team
 *  @title ERC20 WHBAR contract
 */
contract WrappedToken is ERC20Pausable, Ownable {
    /// @notice The router address of the contract
    address public routerAddress;

    /// @notice An event emitted once the router address is changed
    event RouterAddressSet(address newRouterAddress);

    /// @notice Allows only router contract for msg.sender
    modifier onlyRouterCountract() {
        require(
            msg.sender == routerAddress,
            "WHBAR: Not called by the router contract"
        );
        _;
    }

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

    /**
     * @notice Mints `amount` of tokens to the `account` address
     * @param account The address to which the tokens will be minted
     * @param amount The amount to be minted
     */
    function mint(address account, uint256 amount) public onlyRouterCountract {
        super._mint(account, amount);
    }

    /**
     * @notice Burns `amount` of tokens from the `account` address
     * @param account The address from which the tokens will be burned
     * @param amount The amount to be burned
     */
    function burnFrom(address account, uint256 amount)
        public
        onlyRouterCountract
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

    /// @notice Changes the router address
    function setRouterAddress(address _routerAddress) public onlyOwner {
        require(
            _routerAddress != address(0),
            "WHBAR: router address cannot be zero"
        );
        routerAddress = _routerAddress;
        emit RouterAddressSet(routerAddress);
    }
}
