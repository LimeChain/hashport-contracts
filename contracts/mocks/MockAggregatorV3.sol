// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 private _decimals;
    int256 private _answer;
    uint80 private _roundId;
    uint256 private _startedAt;
    uint256 private _updatedAt;
    uint80 private _answeredInRound;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _roundId = 1;
        _answer = initialAnswer;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
        _answeredInRound = 1;
    }

    function updateAnswer(int256 newAnswer) external {
        _roundId++;
        _answer = newAnswer;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
        _answeredInRound = _roundId;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external pure override returns (string memory) {
        return "ETH / USD";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _startedAt, _updatedAt, _answeredInRound);
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _startedAt, _updatedAt, _answeredInRound);
    }
}
