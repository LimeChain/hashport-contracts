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

    /// @notice An event emitted once a BurnERC721 transaction is executed
    event BurnERC721(
        uint256 targetChain,
        address wrappedToken,
        uint256 tokenId,
        bytes receiver
    );

    /// @notice An event emitted once a new wrapped ERC-721 token is deployed by the contract
    event WrappedTokenERC721Deployed(
        uint256 sourceChain,
        bytes nativeToken,
        address wrappedTokenERC721
    );

    /// @notice An event emitted once an ERC-721 payment token and fee is modified
    event SetERC721Payment(address erc721, address payment, uint256 fee);

    /// @notice Mints `_tokenId` wrapped to the `receiver` address.
    ///         Must be authorised by the configured supermajority threshold of `signatures` from the `members` set.
    /// @param _sourceChain ID of the source chain
    /// @param _transactionId The source transaction ID + log index
    /// @param _wrappedToken The address of the wrapped ERC-721 token on the current chain
    /// @param _tokenId The target token ID
    /// @param _metadata The tokenID's metadata, used to be queried as ERC-721.tokenURI
    /// @param _receiver The address of the receiver on this chain
    /// @param _signatures The array of signatures from the members, authorising the operation
    function mintERC721(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _wrappedToken,
        uint256 _tokenId,
        string memory _metadata,
        address _receiver,
        bytes[] calldata _signatures
    ) external;

    /// @notice Burns `_tokenId` of `wrappedToken` initializes a portal transaction to the target chain
    ///         The wrappedToken's fee payment is transferred to the contract upon execution.
    /// @param _targetChain The target chain to which the wrapped asset will be transferred
    /// @param _wrappedToken The address of the wrapped token
    /// @param _tokenId The tokenID of `wrappedToken` to burn
    /// @param _receiver The address of the receiver on the target chain
    function burnERC721(
        uint256 _targetChain,
        address _wrappedToken,
        uint256 _tokenId,
        bytes memory _receiver
    ) external;

    /// @notice Deploys a wrapped version of an ERC-721/NFT token to the current chain
    /// @param _sourceChain The chain where `nativeToken` is originally deployed to
    /// @param _nativeToken The address of the token
    /// @param _tokenParams The name/symbol to use for the wrapped version of `nativeToken`
    function deployWrappedTokenERC721(
        uint256 _sourceChain,
        bytes memory _nativeToken,
        WrappedTokenERC721Params memory _tokenParams
    ) external;

    /// @notice Sets ERC-721 contract payment token and fee amount
    /// @param _erc721 The target ERC-721 contract
    /// @param _payment The target payment token
    /// @param _fee The fee required upon every portal transfer
    function setERC721Payment(
        address _erc721,
        address _payment,
        uint256 _fee
    ) external;
}
