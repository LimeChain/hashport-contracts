// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IOracle {
    /// @notice An event emitted once the price feed is updated
    event PriceFeedUpdated(address indexed priceFeed);

    /// @notice Initializes the Oracle with a price feed address
    /// @param _priceFeed The address of the Chainlink AggregatorV3Interface price feed
    function initOracle(address _priceFeed) external;

    /// @notice Sets the price feed address
    /// @param _priceFeed The address of the Chainlink AggregatorV3Interface price feed
    function setPriceFeedAddress(address _priceFeed) external;

    /// @notice Returns the native token price with 18 decimals
    /// @return The price in USD with 18 decimals as uint256
    function getNativeTokenPrice() external view returns (uint256);

    /// @notice Returns the address of the configured price feed
    /// @return The price feed address
    function getPriceFeedAddress() external view returns (address);
}
