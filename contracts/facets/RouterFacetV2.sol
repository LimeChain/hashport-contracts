// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../WrappedToken.sol";
import "../interfaces/IRouterV2.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibRouter.sol";
import "../libraries/LibGovernance.sol";

contract RouterFacetV2 is IRouterV2 {
    using SafeERC20 for IERC20;

    /// @notice An event emitted once an Unlock transaction is executed
    event Unlock(
        uint256 sourceChain,
        bytes transactionId,
        address token,
        uint256 amount,
        address receiver,
        uint256 serviceFee
    );

    /// @notice Transfers `amount` native tokens to the `receiver` address.
    ///         Must be authorised by the configured supermajority threshold of `signatures` from the `members` set.
    ///         The method supports already calculated fee from the validators.
    /// @param _sourceChain The chainId of the chain that we're bridging from
    /// @param _transactionId The transaction ID + log index in the source chain
    /// @param _nativeToken The address of the native token
    /// @param _amount The amount to transfer
    /// @param _receiver The address reveiving the tokens
    /// @param _calculatedFee Calculated fee by the validator
    /// @param _signatures The array of signatures from the members, authorising the operation
    function unlockWithFee(
        uint256 _sourceChain,
        bytes memory _transactionId,
        address _nativeToken,
        uint256 _amount,
        address _receiver,
        uint256 _calculatedFee,
        bytes[] calldata _signatures
    ) external override whenNotPaused onlyNativeToken(_nativeToken) {
        LibGovernance.validateSignaturesLength(_signatures.length);

        bytes32 ethHash = computeMessageWithFee(
            _sourceChain,
            block.chainid,
            _transactionId,
            _nativeToken,
            _receiver,
            _amount,
            _calculatedFee
        );

        LibRouter.Storage storage rs = LibRouter.routerStorage();

        require(
            !rs.hashesUsed[ethHash],
            "RouterFacet: transaction already submitted"
        );

        validateAndStoreTx(ethHash, _signatures);

        uint256 serviceFee = LibFeeCalculator.distributeRewardsWithFee(
            _nativeToken,
            _amount,
            _calculatedFee
        );

        uint256 transferAmount = _amount - serviceFee;

        IERC20(_nativeToken).safeTransfer(_receiver, transferAmount);

        emit Unlock(
            _sourceChain,
            _transactionId,
            _nativeToken,
            transferAmount,
            _receiver,
            serviceFee
        );
    }

    /// @notice Computes the bytes32 ethereum signed message hash for signatures
    /// @param _sourceChain The chain where the bridge transaction was initiated from
    /// @param _targetChain The target chain of the bridge transaction.
    ///                     Should always be the current chainId.
    /// @param _transactionId The transaction ID of the bridge transaction
    /// @param _token The address of the token on this chain
    /// @param _receiver The receiving address on the current chain
    /// @param _amount The amount of `_token` that is being bridged
    /// @param _calculatedFee Calculated fee in case of unlock operation from whitelisted account
    function computeMessageWithFee(
        uint256 _sourceChain,
        uint256 _targetChain,
        bytes memory _transactionId,
        address _token,
        address _receiver,
        uint256 _amount,
        uint256 _calculatedFee
    ) internal pure returns (bytes32) {
        bytes32 hashedData = keccak256(
            abi.encode(
                _sourceChain,
                _targetChain,
                _transactionId,
                _token,
                _receiver,
                _amount,
                _calculatedFee
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

    modifier onlyNativeToken(address _nativeToken) {
        require(
            LibRouter.containsNativeToken(_nativeToken),
            "RouterFacet: native token not found"
        );
        _;
    }

    /// Modifier to make a function callable only when the contract is not paused
    modifier whenNotPaused() {
        LibGovernance.enforceNotPaused();
        _;
    }
}
