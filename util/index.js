const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

function getInterfaceId(contract) {
  const selectors = getSelectors(contract);

  const result = selectors.reduce((result, value) => {
    return result.xor(value);
  }, BigNumber.from(0));

  return ethers.utils.hexValue(result);
}

function getSelectors(contract) {
  const signatures = Object.keys(contract.interface.functions);

  return signatures.reduce((acc, val) => {
    if (val !== 'init(bytes)') {
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, []);
}

async function createPermit(owner, spenderAddress, amount, deadline, tokenContract) {
  const Permit = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ];

  const domain = {
    name: await tokenContract.name(),
    version: '1',
    chainId: '31337',
    verifyingContract: tokenContract.address
  };

  const message = {
    owner: owner.address,
    spender: spenderAddress,
    value: amount,
    nonce: await tokenContract.nonces(owner.address),
    deadline: deadline
  };

  const result = await owner._signTypedData(domain, { Permit }, message);
  return {
    r: result.slice(0, 66),
    s: '0x' + result.slice(66, 130),
    v: parseInt(result.slice(130, 132), 16),
  };
}

async function diamondAsFacet(diamond, facetName) {
  return await ethers.getContractAt(facetName, diamond.address);
}

module.exports = {
  createPermit,
  diamondAsFacet,
  getInterfaceId,
  getSelectors
};