// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "../interfaces/IFeePolicyFacet.sol";
import "../interfaces/IEntityFeePolicyStore.sol";
import "../libraries/LibDiamond.sol";
import "../libraries/LibFeeCalculator.sol";
import "../libraries/LibFeePolicy.sol";

contract FeePolicyFacet is IFeePolicyFacet {
    /// @notice Adds array of user address to EntityFeePolicyStore.
    /// @param _storeAddress Address of EntityFeePolicyStore.
    /// @param _userAddresses Array of user addresses to be added to the policy.
    function addFeePolicyUsers(address _storeAddress, address[] memory _userAddresses) external override {
        LibDiamond.enforceIsContractOwner();

        require(_storeAddress != address(0), "FeeCalculatorFacet: _storeAddress must not be 0x0");

        LibFeePolicy.addFeePolicyUsers(_storeAddress, _userAddresses);
    }

    /// @notice Removes array of users from EntityFeePolicyStore.
    /// @param _storeAddress Address of EntityFeePolicyStore.
    /// @param _userAddresses Array of user addresses to be removed from the policy.
    function removeFeePolicyUsers(address _storeAddress, address[] memory _userAddresses) external override {
        LibDiamond.enforceIsContractOwner();

        require(_storeAddress != address(0), "FeeCalculatorFacet: _storeAddress must not be 0x0");

        LibFeePolicy.removeFeePolicyUsers(_storeAddress, _userAddresses);
    }

    /// @notice Removes token address from EntityFeePolicyStore.
    /// @param _storeAddress Address of EntityFeePolicyStore.
    /// @param _tokenAddress Address of a token to be removed from the policy.
    function removeFeePolicyToken(address _storeAddress, address _tokenAddress) external override {
        LibDiamond.enforceIsContractOwner();

        require(_storeAddress != address(0), "FeeCalculatorFacet: _storeAddress must not be 0x0");
        require(_tokenAddress != address(0), "FeeCalculatorFacet: _tokenAddress must not be 0x0");

        IEntityFeePolicyStore(_storeAddress).removeFeePolicyToken(_tokenAddress);
    }

    /// @notice Sets flat fee policy to token by EntityFeePolicyStore.
    /// @param _storeAddress Address of EntityFeePolicyStore.
    /// @param _tokenAddress Address of the token subject to the fee policy.
    /// @param _value Value of the flat fee.
    function setFlatFeeTokenPolicy(
        address _storeAddress,
        address _tokenAddress,
        uint256 _value
    ) external override {
        LibDiamond.enforceIsContractOwner();

        require(_storeAddress != address(0), "FeeCalculatorFacet: _storeAddress must not be 0x0");
        require(_tokenAddress != address(0), "FeeCalculatorFacet: _tokenAddress must not be 0x0");

        require(_value > 0, "FeeCalculatorFacet: flat fee _value is zero");

        IEntityFeePolicyStore(_storeAddress).setFlatFeeTokenPolicy(_tokenAddress, _value);
    }

    /// @notice Sets percentage fee policy to token by EntityFeePolicyStore.
    /// @param _storeAddress Address of EntityFeePolicyStore.
    /// @param _tokenAddress Address of the token subject to the fee policy.
    /// @param _value Value of the percentage fee.
    function setPercentageFeeTokenPolicy(
        address _storeAddress,
        address _tokenAddress,
        uint256 _value
    ) external override {
        LibDiamond.enforceIsContractOwner();

        require(_storeAddress != address(0), "FeeCalculatorFacet: _storeAddress must not be 0x0");
        require(_tokenAddress != address(0), "FeeCalculatorFacet: _tokenAddress must not be 0x0");

        require(_value > 0 && _value < LibFeeCalculator.precision(), "FeeCalculatorFacet: precentage fee _value is zero");

        IEntityFeePolicyStore(_storeAddress).setPercentageFeeTokenPolicy(_tokenAddress, _value);
    }

    /// @notice Sets tiers fee policies to token by EntityFeePolicyStore.
    /// @dev The method is using vertical split approach to handle multiple tiers. All arrays should be with the same length.
    /// @param _storeAddress Address of EntityFeePolicyStore.
    /// @param _tokenAddress Address of the token subject to the fee policy.
    /// @param feeTypeArr List of FeeType for each tier.
    /// @param amountFromArr List of values representing amount min range for each tier.
    /// @param amountToArr List of values representing amount max range for each tier.
    /// @param hasFromArr List of values representing if amount min range is set for each tier.
    /// @param hasToArr List of values representing if amount max range is set for each tier.
    /// @param feeValueArr List of values representing the flat or percentage fee for each tier.
    function setTiersTokenPolicy(
        address _storeAddress,
        address _tokenAddress,
        uint256[] memory feeTypeArr,
        uint256[] memory amountFromArr,
        uint256[] memory amountToArr,
        bool[] memory hasFromArr,
        bool[] memory hasToArr,
        uint256[] memory feeValueArr
    ) external override {
        LibDiamond.enforceIsContractOwner();

        require(_storeAddress != address(0), "FeeCalculatorFacet: _storeAddress must not be 0x0");
        require(_tokenAddress != address(0), "FeeCalculatorFacet: _tokenAddress must not be 0x0");

        require(
            feeTypeArr.length == amountFromArr.length &&
                amountFromArr.length == amountToArr.length &&
                amountToArr.length == hasFromArr.length &&
                hasFromArr.length == hasToArr.length &&
                hasToArr.length == feeValueArr.length,
            "FeeCalculatorFacet: Invalid input primitive arrays length"
        );

        // Validate fee values against precision
        uint256 precision = LibFeeCalculator.precision();

        // remove
        IEntityFeePolicyStore(_storeAddress).removeFeePolicyToken(_tokenAddress);

        for (uint256 i = 0; i < feeTypeArr.length; i++) {
            require(
                (feeTypeArr[i] == 0 && feeValueArr[i] > 0) || (feeValueArr[i] > 0 && feeValueArr[i] < precision),
                "FeeCalculatorFacet: Fee value is not correct"
            );

            IEntityFeePolicyStore(_storeAddress).addTierTokenPolicy(
                _tokenAddress,
                feeTypeArr[i],
                amountFromArr[i],
                amountToArr[i],
                hasFromArr[i],
                hasToArr[i],
                feeValueArr[i]
            );
        }
    }

    /// @notice Removes token address from EntityFeePolicyStore.
    /// @param _storeAddress Address of EntityFeePolicyStore.
    /// @param _tokenAddress Address of the token to be removed.
    function removeTokenFeePolicy(address _storeAddress, address _tokenAddress) external override {
        LibDiamond.enforceIsContractOwner();

        require(_storeAddress != address(0), "FeeCalculatorFacet: _storeAddress must not be 0x0");
        require(_tokenAddress != address(0), "FeeCalculatorFacet: _tokenAddress must not be 0x0");

        IEntityFeePolicyStore(_storeAddress).removeFeePolicyToken(_tokenAddress);
    }

    /// @notice Gets address of EntityFeePolicyStore by user address
    /// @dev Used for test purposes
    /// @param _userAddress Address of the user
    /// @return Address for the EntityFeePolicyStore
    function feePolicyStoreAddress(address _userAddress) external view override returns (address) {
        LibDiamond.enforceIsContractOwner();
        LibFeePolicy.Storage storage _feePolicyStorage = LibFeePolicy.feePolicyStorage();

        return _feePolicyStorage.userStoreAddresses[_userAddress];
    }

    /// @notice Accepts only `msg.sender` part of the members
    modifier onlyMember(address _member) {
        require(LibGovernance.isMember(_member), "FeeCalculatorFacet: _member is not a member");
        _;
    }
}
