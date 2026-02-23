// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "../libraries/LibOracle.sol";
import "../interfaces/IOracle.sol";
import "../libraries/LibDiamond.sol";

contract OracleFacet is IOracle {
    /// @notice Initializes the Oracle with the source chain's price feed and destination chain feeds
    /// @param _priceFeed The Chainlink price feed for source chain's native token
    /// @param _destinationChainIds Destination chain IDs
    /// @param _destinationPriceFeeds Chainlink price feed addresses matching each destination chain ID
    function initOracle(address _priceFeed, uint256[] calldata _destinationChainIds, address[] calldata _destinationPriceFeeds) external override {
        LibOracle.Storage storage os = LibOracle.oracleStorage();
        require(!os.initialized, "OracleFacet: already initialized");
        require(_priceFeed != address(0), "OracleFacet: price feed cannot be zero address");
        require(_destinationChainIds.length == _destinationPriceFeeds.length, "OracleFacet: length mismatch");
        os.initialized = true;
        os.priceFeed = AggregatorV3Interface(_priceFeed);
        emit SourcePriceFeedUpdated(_priceFeed);
        for (uint256 i = 0; i < _destinationChainIds.length; i++) {
            require(_destinationChainIds[i] != 0, "OracleFacet: invalid chain id");
            require(_destinationPriceFeeds[i] != address(0), "OracleFacet: price feed cannot be zero address");
            os.priceFeeds[_destinationChainIds[i]] = AggregatorV3Interface(_destinationPriceFeeds[i]);
            emit DestinationPriceFeedUpdated(_destinationChainIds[i], _destinationPriceFeeds[i]);
        }
    }

    /// @notice Sets or updates the price feed for the source (current) chain
    /// @param _priceFeed The Chainlink price feed address
    function setSourceChainPriceFeed(address _priceFeed) external override {
        LibDiamond.enforceIsContractOwner();
        require(_priceFeed != address(0), "OracleFacet: price feed cannot be zero address");
        LibOracle.oracleStorage().priceFeed = AggregatorV3Interface(_priceFeed);
        emit SourcePriceFeedUpdated(_priceFeed);
    }

    /// @notice Sets or updates the price feed for a destination chain
    /// @param _chainId The destination chain ID
    /// @param _priceFeed The Chainlink price feed address for that chain's native token
    function setDestinationChainPriceFeed(uint256 _chainId, address _priceFeed) external override {
        LibDiamond.enforceIsContractOwner();
        require(_chainId != 0, "OracleFacet: invalid chain id");
        require(_priceFeed != address(0), "OracleFacet: price feed cannot be zero address");
        LibOracle.oracleStorage().priceFeeds[_chainId] = AggregatorV3Interface(_priceFeed);
        emit DestinationPriceFeedUpdated(_chainId, _priceFeed);
    }

    /// @notice Returns the source chain's native token price in USD with 18 decimals
    function getNativeTokenPrice() external view override returns (uint256) {
        return LibOracle.getNativeTokenPrice();
    }

    /// @notice Returns the native token price in USD for a destination chain with 18 decimals
    /// @param _chainId The destination chain ID
    function getDestinationTokenPrice(uint256 _chainId) external view override returns (uint256) {
        return LibOracle.getDestinationTokenPrice(_chainId);
    }

    /// @notice Returns the price feed address for the source (current) chain
    function getSourceChainPriceFeed() external view override returns (address) {
        return LibOracle.priceFeedAddress();
    }

    /// @notice Returns the price feed address for a destination chain
    /// @param _chainId The destination chain ID
    function getDestinationChainPriceFeed(uint256 _chainId) external view override returns (address) {
        return LibOracle.priceFeedAddress(_chainId);
    }
}
