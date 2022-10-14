// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface IFeePolicyFacet {
    function addFeePolicyUsers(address _storeAddress, address[] memory _userAddresses) external;

    function removeFeePolicyUsers(address _storeAddress, address[] memory _userAddresses) external;

    function removeFeePolicyToken(address _storeAddress, address _tokenAddress) external;

    function setFlatFeeTokenPolicy(
        address _storeAddress,
        address _tokenAddress,
        uint256 _value
    ) external;

    function setPercentageFeeTokenPolicy(
        address _storeAddress,
        address _tokenAddress,
        uint256 _value
    ) external;

    function setTiersTokenPolicy(
        address _storeAddress,
        address _tokenAddress,
        uint256[] memory feeTypeArr,
        uint256[] memory amountFromArr,
        uint256[] memory amountToArr,
        bool[] memory hasFromArr,
        bool[] memory hasToArr,
        uint256[] memory feeValueArr
    ) external;

    function removeTokenFeePolicy(address _storeAddress, address _tokenAddress) external;

    function feePolicyStoreAddress(address _userAddress) external view returns (address);
}
