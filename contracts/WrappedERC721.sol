// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract WrappedERC721 is ERC721Enumerable, ERC721Burnable, Ownable {
    // Mapping from tokenID to metadata
    mapping(uint256 => string) private _metadata;

    constructor(string memory _name, string memory _symbol)
        ERC721(_name, _symbol)
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

    function burn(uint256 tokenId) public virtual override onlyOwner {
        super.burn(tokenId);

        delete _metadata[tokenId];
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
