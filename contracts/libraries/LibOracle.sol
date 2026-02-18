// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

library LibOracle {
    bytes32 constant STORAGE_POSITION = keccak256("oracle.storage");

    struct Storage {
        AggregatorV3Interface priceFeed;
        bool initialized;
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
            return _price * (10**(18 - _decimals));
        } else if (_decimals > 18) {
            return _price / (10**(_decimals - 18));
        } else {
            return _price;
        }
    }

    /// @notice Returns the native token price with 18 decimals
    /// @dev Normalizes the Chainlink answer to 18 decimals
    function getNativeTokenPrice() internal view returns (uint256) {
        Storage storage os = oracleStorage();
        (, int256 answer, , , ) = os.priceFeed.latestRoundData();
        require(answer > 0, "LibOracle: invalid price");
        uint8 feedDecimals = os.priceFeed.decimals();

        return convertTo18Decimals(uint256(answer), feedDecimals);
    }

    /// @notice Returns the address of the configured price feed
    function priceFeedAddress() internal view returns (address) {
        Storage storage os = oracleStorage();
        return address(os.priceFeed);
    }
}
