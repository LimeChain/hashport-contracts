<div align="center">

# Hedera <-> EVM Bridge Contracts

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Compile](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/compile.yml/badge.svg?branch=main)](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/compile.yml)
[![Test](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/test.yml)

</div>

This repository contains the smart contracts for the Hedera <-> EVM bridge.

## Overview
Smart Contracts use [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535).

## Contract Addresses & ABI
This is still under development, and the contracts have not been deployed on mainnets yet.

## Development
### Prerequisites
[node.js](https://nodejs.org/en/) >= v14.17.0

[hardhat](https://hardhat.org/) - framework used for the development and testing of the contracts

After cloning, run:
```
cd hedera-eth-bridge-contracts
npm install
```

### Compilation
Before you deploy the contracts, you will need to compile them using:

```
npx hardhat compile
```

### Scripts
Before running any `npx hardhat` scripts, you need to set the following environment variables 
in [hardhat config](./hardhat.config.js) or export them:

```
export INFURA_PROJECT_ID=<id here as seen on your Infura project dashboard>
export ROPSTEN_PRIVATE_KEY=<private key to use for deployments on Ethereum Ropsten>
export MUMBAI_PRIVATE_KEY=<private key to use for deployments on Polygon Mumbai>
```

#### Router deployment
* Deploys all the facets
* Deploys the Router Diamond with all the facets as diamond cuts
* Initializes `GovernanceFacet` with the provided list of members, governance percentage, and governance precision
* Initializes `RouterFacet`
* Initializes `FeeCalculatorFacet` with the provided fee precision. 

```bash
npx hardhat deploy-router \
    --network <network name> \ 
    --owner <owner address> \
    --governance-percentage <governance percentage> \
    --governance-precision <governance precision> \
    --fee-calculator-precision <fee calculator precision> \
    <list of members>
```

#### Wrapped token deployment through Router
Deploys a wrapped token for a corresponding token on another chain: 
```bash
npx hardhat deploy-wrapped-token \
    --network <network name> \
    --router <address of the router diamond contract> \
    --source <id of the source chain, to which the native token is deployed> \
    --native <the unique identifier of the native token> \
    --name <name of the wrapped token> \
    --symbol <symbol of the wrapped token> \
    --decimals <decimals of the wrapped token>
```

#### Token deployment
Deploys an instance of a [Token](./contracts/mocks/Token.sol) contract, used mainly for testing purposes.
```bash
npx hardhat deploy-token \
    --network <network name> \
    --name <name of the token> \
    --symbol <symbol of the token> \
    --decimals <decimals of the token>
```

#### Tests
##### Unit Tests
```bash
npx hardhat tests
```

##### Coverage
```bash
npx hardhat coverage
```
