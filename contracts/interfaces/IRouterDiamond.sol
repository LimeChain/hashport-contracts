// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "./IDiamondCut.sol";
import "./IDiamondLoupe.sol";
import "./IERC173.sol";
import "./IFeeCalculator.sol";
import "./IRouter.sol";
import "./IGovernance.sol";

interface IRouterDiamond is
    IERC165,
    IDiamondCut,
    IDiamondLoupe,
    IGovernance,
    IFeeCalculator,
    IERC173,
    IRouter
{}
