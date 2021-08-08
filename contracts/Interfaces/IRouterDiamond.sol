// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./IDiamondCut.sol";
import "./IDiamondLoupe.sol";
import "./IFeeCalculator.sol";
import "./IRouter.sol";
import "./IGovernance.sol";

interface IRouterDiamond is IGovernance, IDiamondCut, IDiamondLoupe, IFeeCalculator, IRouter {}