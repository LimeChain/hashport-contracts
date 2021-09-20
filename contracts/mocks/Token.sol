//SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../ERC20Permit.sol";

/// @notice Mainly used for testing
contract Token is ERC20Permit, Ownable {
    uint8 private immutable _decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 decimals_
    ) ERC20(_name, _symbol) {
        _decimals = decimals_;
    }

    function mint(address _account, uint256 _amount) public onlyOwner {
        super._mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) public onlyOwner {
        super._burn(_account, _amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
