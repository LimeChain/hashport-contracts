// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "../libraries/LibOracle.sol";
import "../interfaces/IOracle.sol";
import "../libraries/LibDiamond.sol";

contract OracleFacet is IOracle {
    /// @notice Initializes the Oracle with a Chainlink AggregatorV3Interface price feed address
    /// @param _priceFeed The address of the Chainlink price feed
    function initOracle(address _priceFeed) external override {
        LibOracle.Storage storage os = LibOracle.oracleStorage();
        require(!os.initialized, "OracleFacet: already initialized");
        require(
            _priceFeed != address(0),
            "OracleFacet: price feed cannot be zero address"
        );
        os.priceFeed = AggregatorV3Interface(_priceFeed);
        os.initialized = true;

        emit PriceFeedUpdated(_priceFeed);
    }

    /// @notice Sets the Chainlink price feed address
    /// @param _priceFeed The address of the Chainlink price feed
    function setPriceFeedAddress(address _priceFeed) external override {
        LibDiamond.enforceIsContractOwner();
        require(
            _priceFeed != address(0),
            "OracleFacet: price feed cannot be zero address"
        );
        LibOracle.Storage storage os = LibOracle.oracleStorage();
        os.priceFeed = AggregatorV3Interface(_priceFeed);

        emit PriceFeedUpdated(_priceFeed);
    }

    /// @notice Returns the native token price in USD with 18 decimals
    /// @return The price as uint256
    function getNativeTokenPrice() external view override returns (uint256) {
        return LibOracle.getNativeTokenPrice();
    }

    /// @notice Returns the address of the configured price feed
    /// @return The price feed address
    function getPriceFeedAddress() external view override returns (address) {
        return LibOracle.priceFeedAddress();
    }
}
