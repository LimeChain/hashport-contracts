// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IOracle {
    /// @notice Emitted when the source chain's price feed is updated
    event SourcePriceFeedUpdated(address indexed priceFeed);
    /// @notice Emitted when a destination chain's price feed is updated
    event DestinationPriceFeedUpdated(uint256 indexed chainId, address indexed priceFeed);

    /// @notice Initializes the Oracle with the source chain's price feed and optional destination chain feeds
    /// @param _priceFeed The Chainlink price feed for source chain's native token
    /// @param _destinationChainIds Destination chain IDs
    /// @param _destinationPriceFeeds Chainlink price feed addresses matching each destination chain ID
    function initOracle(address _priceFeed, uint256[] calldata _destinationChainIds, address[] calldata _destinationPriceFeeds) external;

    /// @notice Sets or updates the price feed for the source (current) chain
    /// @param _priceFeed The Chainlink price feed address
    function setSourceChainPriceFeed(address _priceFeed) external;

    /// @notice Sets or updates the price feed for a destination chain
    /// @param _chainId The destination chain ID
    /// @param _priceFeed The Chainlink price feed address for that chain's native token
    function setDestinationChainPriceFeed(uint256 _chainId, address _priceFeed) external;

    /// @notice Returns the source chain's native token price in USD with 18 decimals
    function getNativeTokenPrice() external view returns (uint256);

    /// @notice Returns the native token price in USD for a destination chain with 18 decimals
    /// @param _chainId The destination chain ID
    function getDestinationTokenPrice(uint256 _chainId) external view returns (uint256);

    /// @notice Returns the price feed address for the source (current) chain
    function getSourceChainPriceFeed() external view returns (address);

    /// @notice Returns the price feed address for a destination chain
    /// @param _chainId The destination chain ID
    function getDestinationChainPriceFeed(uint256 _chainId) external view returns (address);
}
