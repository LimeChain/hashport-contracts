// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

struct WrappedTokenERC721Params {
    string name;
    string symbol;
}

interface IERC721PortalFacet {
    /// @notice An even emitted once a MintERC721 transaction is executed
    event MintERC721(
        uint256 sourceChain,
        bytes transactionId,
        address token,
        uint256 tokenId,
        string metadata,
        address receiver
    );

    /// @notice An event emitted once a new wrapped erc721 token is deployed by the contract
    event WrappedTokenERC721Deployed(
        uint256 sourceChain,
        bytes nativeToken,
        address wrappedTokenERC721
    );

    // TODO:
    function mintERC721(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _wrappedToken,
        uint256 _tokenId,
        string memory _metadata,
        address _receiver,
        bytes[] calldata _signatures
    ) external;

    // TODO:
    function deployWrappedTokenERC721(
        uint256 _sourceChain,
        bytes memory _nativeToken,
        WrappedTokenERC721Params memory _tokenParams
    ) external;
}
