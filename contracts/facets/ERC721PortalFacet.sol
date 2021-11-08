// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../interfaces/IERC721PortalFacet.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibGovernance.sol";
import "../libraries/LibRouter.sol";
import "../WrappedERC721.sol";

contract ERC721PortalFacet is IERC721PortalFacet {
    // TODO:
    function mintERC721(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _wrappedToken,
        uint256 _tokenId,
        string memory _metadata,
        address _receiver,
        bytes[] calldata _signatures
    ) external override whenNotPaused {
        LibGovernance.validateSignaturesLength(_signatures.length);
        bytes32 ethHash = computeMessage(
            _sourceChain,
            block.chainid,
            _transactionId,
            _wrappedToken,
            _tokenId,
            _metadata,
            _receiver
        );

        LibRouter.Storage storage rs = LibRouter.routerStorage();
        require(
            !rs.hashesUsed[ethHash],
            "ERC721PortalFacet: transaction already submitted"
        );
        validateAndStoreTx(ethHash, _signatures);

        WrappedERC721(_wrappedToken).safeMint(_receiver, _tokenId, _metadata);

        emit MintERC721(
            _sourceChain,
            _transactionId,
            _wrappedToken,
            _tokenId,
            _metadata,
            _receiver
        );
    }

    // TODO:
    function deployWrappedTokenERC721(
        uint256 _sourceChain,
        bytes memory _nativeToken,
        WrappedTokenERC721Params memory _tokenParams
    ) external override {
        LibDiamond.enforceIsContractOwner();

        WrappedERC721 t = new WrappedERC721(
            _tokenParams.name,
            _tokenParams.symbol
        );

        emit WrappedTokenERC721Deployed(_sourceChain, _nativeToken, address(t));
    }

    /// @notice Computes the bytes32 ethereum signed message hash for signatures
    /// @param _sourceChain The chain where the bridge transaction was initiated from
    /// @param _targetChain The target chain of the bridge transaction.
    ///                     Should always be the current chainId.
    /// @param _transactionId The transaction ID of the bridge transaction
    /// @param _token The address of the token on this chain
    /// @param _tokenId The token ID for the _token
    /// @param _metadata The metadata for the token ID
    /// @param _receiver The receiving address on the current chain
    function computeMessage(
        uint256 _sourceChain,
        uint256 _targetChain,
        bytes memory _transactionId,
        address _token,
        uint256 _tokenId,
        string memory _metadata,
        address _receiver
    ) internal pure returns (bytes32) {
        bytes32 hashedData = keccak256(
            abi.encode(
                _sourceChain,
                _targetChain,
                _transactionId,
                _token,
                _tokenId,
                _metadata,
                _receiver
            )
        );
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    /// @notice Validates the signatures and the data and saves the transaction
    /// @param _ethHash The hashed data
    /// @param _signatures The array of signatures from the members, authorising the operation
    function validateAndStoreTx(bytes32 _ethHash, bytes[] calldata _signatures)
        internal
    {
        LibRouter.Storage storage rs = LibRouter.routerStorage();
        LibGovernance.validateSignatures(_ethHash, _signatures);
        rs.hashesUsed[_ethHash] = true;
    }

    /// Modifier to make a function callable only when the contract is not paused
    modifier whenNotPaused() {
        LibGovernance.enforceNotPaused();
        _;
    }
}
