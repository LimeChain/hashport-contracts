// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./IDiamondCut.sol";
import "./IDiamondLoupe.sol";
import "./IERC173.sol";
import "./IFeeCalculator.sol";
import "./IRouter.sol";
import "./IGovernance.sol";

interface IRouterDiamond is
    IDiamondCut,
    IDiamondLoupe,
    IGovernance,
    IFeeCalculator,
    IERC173,
    IRouter
{}
