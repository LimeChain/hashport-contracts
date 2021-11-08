// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract WrappedERC721 is ERC721Burnable, Pausable, Ownable {
    // Mapping from tokenID to metadata
    mapping(uint256 => string) private _metadata;

    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
    {}

    function safeMint(
        address to,
        uint256 tokenId,
        string memory metadata
    ) public onlyOwner {
        _safeMint(to, tokenId);

        _metadata[tokenId] = metadata;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "WrappedERC721: URI query for nonexistent token"
        );

        return _metadata[tokenId];
    }

    /// @notice Pauses the contract
    function pause() public onlyOwner {
        super._pause();
    }

    /// @notice Unpauses the contract
    function unpause() public onlyOwner {
        super._unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);

        require(!paused(), "WrappedERC721: token transfer while paused");
    }
}
