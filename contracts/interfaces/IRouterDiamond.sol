// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "./IDiamondCut.sol";
import "./IDiamondLoupe.sol";
import "./IERC173.sol";
import "./IFeeCalculator.sol";
import "./IGovernance.sol";
import "./IPausable.sol";
import "./IRouter.sol";

interface IRouterDiamond is
    IERC165,
    IDiamondCut,
    IDiamondLoupe,
    IGovernance,
    IFeeCalculator,
    IERC173,
    IPausable,
    IRouter
{}
