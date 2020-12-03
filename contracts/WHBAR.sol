pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WHBAR is ERC20, Ownable {
    uint8 constant HBAR_DECIMALS = 8;

    constructor() public ERC20("WHBAR Token", "WHBAR") {
        super._setupDecimals(HBAR_DECIMALS);
    }

    function burn(address account, uint256 amount) public onlyOwner {
        super._burn(account, amount);
    }

    function mint(address account, uint256 amount) public onlyOwner {
        super._mint(account, amount);
    }
}
