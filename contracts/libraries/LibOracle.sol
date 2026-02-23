// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

library LibOracle {
    bytes32 constant STORAGE_POSITION = keccak256("oracle.storage");

    struct Storage {
        bool initialized;
        // Price feed for the current (source) chain's native token
        AggregatorV3Interface priceFeed;
        // destination chainId => price feed for that chain's native token
        mapping(uint256 => AggregatorV3Interface) priceFeeds;
    }

    function oracleStorage() internal pure returns (Storage storage os) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            os.slot := position
        }
    }

    /// @notice Converts a price from source decimals to 18 decimals
    /// @param _price The price value to convert
    /// @param _decimals The current number of decimals in the price
    /// @return The price normalized to 18 decimals
    function convertTo18Decimals(uint256 _price, uint8 _decimals) internal pure returns (uint256) {
        if (_decimals < 18) {
            return _price * (10 ** (18 - _decimals));
        } else if (_decimals > 18) {
            return _price / (10 ** (_decimals - 18));
        } else {
            return _price;
        }
    }

    /// @notice Returns the current chain's native token price in USD with 18 decimals
    function getNativeTokenPrice() internal view returns (uint256) {
        Storage storage os = oracleStorage();
        require(address(os.priceFeed) != address(0), "LibOracle: no price feed for current chain");
        (, int256 answer, , , ) = os.priceFeed.latestRoundData();
        require(answer > 0, "LibOracle: invalid price");

        return convertTo18Decimals(uint256(answer), os.priceFeed.decimals());
    }

    /// @notice Returns the native token price in USD for a destination chain with 18 decimals
    /// @param _chainId The destination chain ID
    function getDestinationTokenPrice(uint256 _chainId) internal view returns (uint256) {
        Storage storage os = oracleStorage();
        AggregatorV3Interface feed = os.priceFeeds[_chainId];
        require(address(feed) != address(0), "LibOracle: no price feed for chain");
        (, int256 answer, , , ) = feed.latestRoundData();
        require(answer > 0, "LibOracle: invalid price");

        return convertTo18Decimals(uint256(answer), feed.decimals());
    }

    /// @notice Returns the price feed address for the current chain
    function priceFeedAddress() internal view returns (address) {
        return address(oracleStorage().priceFeed);
    }

    /// @notice Returns the price feed address for a destination chain
    /// @param _chainId The destination chain ID
    function priceFeedAddress(uint256 _chainId) internal view returns (address) {
        return address(oracleStorage().priceFeeds[_chainId]);
    }
}
