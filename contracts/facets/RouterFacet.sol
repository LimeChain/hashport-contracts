// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../WrappedToken.sol";
import "../interfaces/IERC2612Permit.sol";
import "../interfaces/IRouter.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibRouter.sol";
import "../libraries/LibGovernance.sol";

contract RouterFacet is IRouter {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    /// @notice Constructs the Router contract instance
    function initRouter() external override {
        LibRouter.Storage storage rs = LibRouter.routerStorage();
        require(!rs.initialized, "Router: already initialized");
        rs.initialized = true;
    }

    /// @param _chainId The chainId of the source chain
    /// @param _ethHash The ethereum signed message hash
    /// @return Whether this hash has already been used for a mint/unlock transaction
    function hashesUsed(uint256 _chainId, bytes32 _ethHash)
        external
        view
        override
        returns (bool)
    {
        LibRouter.Storage storage rs = LibRouter.routerStorage();
        return rs.hashesUsed[_chainId][_ethHash];
    }

    /// @return The count of native tokens in the set
    function nativeTokensCount() external view override returns (uint256) {
        return LibRouter.nativeTokensCount();
    }

    /// @return The address of the native token at a given index
    function nativeTokenAt(uint256 _index)
        external
        view
        override
        returns (address)
    {
        return LibRouter.nativeTokenAt(_index);
    }

    /// @notice Transfers `amount` native tokens to the router contract.
    ///        The router must be authorised to transfer the native token.
    /// @param _targetChain The target chain for the bridging operation
    /// @param _nativeToken The token to be bridged
    /// @param _amount The amount of tokens to bridge
    /// @param _receiver The address of the receiver in the target chain
    function lock(
        uint256 _targetChain,
        address _nativeToken,
        uint256 _amount,
        bytes memory _receiver
    ) public override onlyNativeToken(_nativeToken) {
        LibFeeCalculator.Storage storage fcs = LibFeeCalculator
            .feeCalculatorStorage();
        LibFeeCalculator.distributeRewards(_nativeToken);
        IERC20(_nativeToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        emit Lock(
            _targetChain,
            _nativeToken,
            _receiver,
            _amount,
            fcs.nativeTokenFeeCalculators[_nativeToken].serviceFee
        );
    }

    /// @notice Locks the provided amount of nativeToken using an EIP-2612 permit and initiates a bridging transaction
    /// @param _targetChain The chain to bridge the tokens to
    /// @param _nativeToken The native token to bridge
    /// @param _amount The amount of nativeToken to lock and bridge
    /// @param _deadline The deadline for the provided permit
    /// @param _v The recovery id of the permit's ECDSA signature
    /// @param _r The first output of the permit's ECDSA signature
    /// @param _s The second output of the permit's ECDSA signature
    function lockWithPermit(
        uint256 _targetChain,
        address _nativeToken,
        uint256 _amount,
        bytes memory _receiver,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override {
        IERC2612Permit(_nativeToken).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );
        lock(_targetChain, _nativeToken, _amount, _receiver);
    }

    /// @notice Transfers `amount` native tokens to the `receiver` address.
    ///         Must be authorised by a supermajority of `signatures` from the `members` set.
    ///         The router must be authorised to transfer the ABLT tokens for the fee.
    /// @param _sourceChain The chainId of the chain that we're bridging from
    /// @param _transactionId The transaction ID + log index in the source chain
    /// @param _nativeToken The address of the native token
    /// @param _amount The amount to transfer
    /// @param _receiver The address reveiving the tokens
    /// @param _signatures The array of signatures from the members, authorising the operation
    function unlock(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _nativeToken,
        uint256 _amount,
        address _receiver,
        bytes[] calldata _signatures
    ) external override onlyNativeToken(_nativeToken) {
        LibGovernance.validateSignaturesLength(_signatures.length);
        bytes32 ethHash = computeUnlockMessage(
            _sourceChain,
            block.chainid,
            _transactionId,
            abi.encodePacked(_nativeToken),
            _receiver,
            _amount
        );
        LibFeeCalculator.distributeRewards(_nativeToken);

        LibRouter.Storage storage rs = LibRouter.routerStorage();
        require(
            !rs.hashesUsed[_sourceChain][ethHash],
            "Router: transaction already submitted"
        );

        validateAndStoreTx(_sourceChain, ethHash, _signatures);

        IERC20(_nativeToken).safeTransfer(_receiver, _amount);

        emit Unlock(_nativeToken, _amount, _receiver);
    }

    /// @notice Calls burn on the given wrapped token contract with `amount` wrapped tokens from `msg.sender`.
    ///         The router must be authorised to transfer the ABLT tokens for the fee.
    /// @param _wrappedToken The wrapped token to burn
    /// @param _amount The amount of wrapped tokens to be bridged
    /// @param _receiver The address of the user in the original chain for this wrapped token
    function burn(
        address _wrappedToken,
        uint256 _amount,
        bytes memory _receiver
    ) public override {
        WrappedToken(_wrappedToken).burnFrom(msg.sender, _amount);
        emit Burn(_wrappedToken, _amount, _receiver);
    }

    /// @notice Burns `amount` of `wrappedToken` using an EIP-2612 permit and initializes a bridging transaction to the original chain
    /// @param _wrappedToken The address of the wrapped token to burn
    /// @param _amount The amount of `wrappedToken` to burn
    /// @param _receiver The receiving address in the original chain for this wrapped token
    /// @param _deadline The deadline of the provided permit
    /// @param _v The recovery id of the permit's ECDSA signature
    /// @param _r The first output of the permit's ECDSA signature
    /// @param _s The second output of the permit's ECDSA signature
    function burnWithPermit(
        address _wrappedToken,
        uint256 _amount,
        bytes memory _receiver,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override {
        WrappedToken(_wrappedToken).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );
        burn(_wrappedToken, _amount, _receiver);
    }

    /// @notice Mints `amount` wrapped tokens to the `receiver` address.
    ///         Must be authorised by a supermajority of `signatures` from the `members` set.
    ///         The router must be authorised to transfer the ABLT tokens for the fee.
    /// @param _sourceChain ID of the source chain
    /// @param _transactionId The source transaction ID + log index
    /// @param _wrappedToken The address of the wrapped token on the current chain
    /// @param _amount The desired minting amount
    /// @param _receiver The address receiving the tokens
    /// @param _signatures The array of signatures from the members, authorising the operation
    function mint(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _wrappedToken,
        uint256 _amount,
        address _receiver,
        bytes[] calldata _signatures
    ) external override {
        LibGovernance.validateSignaturesLength(_signatures.length);
        bytes32 ethHash = computeMintMessage(
            _sourceChain,
            block.chainid,
            _transactionId,
            _wrappedToken,
            _receiver,
            _amount
        );

        LibRouter.Storage storage rs = LibRouter.routerStorage();
        require(
            !rs.hashesUsed[_sourceChain][ethHash],
            "Router: transaction already submitted"
        );
        validateAndStoreTx(_sourceChain, ethHash, _signatures);

        WrappedToken(_wrappedToken).mint(_receiver, _amount);

        emit Mint(_wrappedToken, _amount, _receiver);
    }

    /// @notice Deploys a wrapped version of `nativeToken` to the current chain
    /// @param _sourceChain The chain where `nativeToken` is originally deployed to
    /// @param _nativeToken The address of the token
    /// @param _tokenParams The name/symbol/decimals to use for the wrapped version of `nativeToken`
    /// @param _signatures The array of signatures from the members, authorising the operation
    function deployWrappedToken(
        uint256 _sourceChain,
        bytes memory _nativeToken,
        WrappedTokenParams memory _tokenParams,
        bytes[] calldata _signatures
    ) external override {
        require(
            bytes(_tokenParams.name).length > 0,
            "Router: empty wrapped token name"
        );
        require(
            bytes(_tokenParams.symbol).length > 0,
            "Router: empty wrapped token symbol"
        );
        require(
            _tokenParams.decimals > 0,
            "Router: invalid wrapped token decimals"
        );
        LibGovernance.validateSignaturesLength(_signatures.length);
        bytes32 ethHash = computeDeployWrappedTokenMessage(
            _sourceChain,
            block.chainid,
            _nativeToken,
            _tokenParams
        );
        LibGovernance.validateSignatures(ethHash, _signatures);

        WrappedToken t = new WrappedToken(
            _tokenParams.name,
            _tokenParams.symbol,
            _tokenParams.decimals
        );

        LibGovernance.Storage storage gs = LibGovernance.governanceStorage();
        gs.administrativeNonce.increment();

        emit WrappedTokenDeployed(_sourceChain, _nativeToken, address(t));
    }

    /// @notice Updates a native token, which will be used for lock/unlock.
    /// @param _nativeToken The native token address
    /// @param _serviceFee The amount of fee, which will be taken upon lock/unlock execution
    /// @param _status Whether the token will be added or removed
    /// @param _signatures The array of signatures from the members, authorising the operation
    function updateNativeToken(
        address _nativeToken,
        uint256 _serviceFee,
        bool _status,
        bytes[] calldata _signatures
    ) external override {
        require(_nativeToken != address(0), "Router: zero address");
        LibGovernance.validateSignaturesLength(_signatures.length);

        bytes32 ethHash = computeAddNativeTokenMessage(
            _nativeToken,
            _serviceFee,
            _status
        );

        LibGovernance.validateSignatures(ethHash, _signatures);
        LibRouter.updateNativeToken(_nativeToken, _status);
        LibFeeCalculator.setServiceFee(_nativeToken, _serviceFee);

        LibGovernance.Storage storage gs = LibGovernance.governanceStorage();
        gs.administrativeNonce.increment();

        emit NativeTokenUpdated(_nativeToken, _serviceFee, _status);
    }

    /// @notice Validates the signatures and the data and saves the transaction
    /// @param _chainId The source chain for this transaction
    /// @param _ethHash The hashed data
    /// @param _signatures The array of signatures from the members, authorising the operation
    function validateAndStoreTx(
        uint256 _chainId,
        bytes32 _ethHash,
        bytes[] calldata _signatures
    ) internal {
        LibRouter.Storage storage rs = LibRouter.routerStorage();
        LibGovernance.validateSignatures(_ethHash, _signatures);
        rs.hashesUsed[_chainId][_ethHash] = true;
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the unlock signatures
    /// @param _sourceChain The chain where the bridge transaction was initiated from
    /// @param _targetChain The target chain of the bridge transaction.
    ///                    Should always be the current chainId.
    /// @param _transactionId The transaction ID of the bridge transaction
    /// @param _nativeToken The token that is being bridged
    /// @param _receiver The receiving address in the current chain
    /// @param _amount The amount of `nativeToken` that is being bridged
    function computeUnlockMessage(
        uint256 _sourceChain,
        uint256 _targetChain,
        bytes memory _transactionId,
        bytes memory _nativeToken,
        address _receiver,
        uint256 _amount
    ) internal pure returns (bytes32) {
        bytes32 hashedData = keccak256(
            abi.encode(
                _sourceChain,
                _targetChain,
                _transactionId,
                _receiver,
                _amount,
                _nativeToken
            )
        );
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of the mint signatures
    /// @param _sourceChain The chain where the bridge transaction was initiated from
    /// @param _targetChain The target chain of the bridge transaction.
    ///                    Should always be the current chainId.
    /// @param _transactionId The transaction ID of the bridge transaction
    /// @param _wrappedToken The address of the wrapped token on this chain
    /// @param _receiver The receiving address in the current chain
    /// @param _amount The amount of `nativeToken` that is being bridged
    function computeMintMessage(
        uint256 _sourceChain,
        uint256 _targetChain,
        bytes memory _transactionId,
        address _wrappedToken,
        address _receiver,
        uint256 _amount
    ) internal pure returns (bytes32) {
        bytes32 hashedData = keccak256(
            abi.encode(
                _sourceChain,
                _targetChain,
                _transactionId,
                _receiver,
                _amount,
                _wrappedToken
            )
        );
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of wrapped token deployment message
    /// @param _sourceChain The chain id where the native token is deployed.
    /// @param _targetChain The target chain of the bridge transaction.
    ///                     Should always be the current chainId.
    /// @param _nativeToken The token to which a wrapped token will be deployed.
    /// @param _tokenParams The parameters of the to-be-deployed wrapped token (name, symbol, decimals).
    function computeDeployWrappedTokenMessage(
        uint256 _sourceChain,
        uint256 _targetChain,
        bytes memory _nativeToken,
        WrappedTokenParams memory _tokenParams
    ) internal view returns (bytes32) {
        LibGovernance.Storage storage gs = LibGovernance.governanceStorage();
        bytes32 hashedData = keccak256(
            abi.encode(
                _sourceChain,
                _targetChain,
                _nativeToken,
                gs.administrativeNonce.current(),
                _tokenParams.name,
                _tokenParams.symbol,
                _tokenParams.decimals
            )
        );
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    /// @notice Computes the bytes32 ethereum signed message hash of add native token message
    /// @param _nativeToken The target native token
    /// @param _serviceFee The target service fee
    /// @param _status Whether the native token will be added or removed
    function computeAddNativeTokenMessage(
        address _nativeToken,
        uint256 _serviceFee,
        bool _status
    ) internal view returns (bytes32) {
        LibGovernance.Storage storage gs = LibGovernance.governanceStorage();
        bytes32 hashedData = keccak256(
            abi.encode(
                _nativeToken,
                _serviceFee,
                _status,
                gs.administrativeNonce.current()
            )
        );
        return ECDSA.toEthSignedMessageHash(hashedData);
    }

    modifier onlyNativeToken(address _nativeToken) {
        require(
            LibRouter.containsNativeToken(_nativeToken),
            "Router: native token not found"
        );
        _;
    }
}
