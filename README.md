<div align="center">

# Hedera <-> EVM Bridge Contracts

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Compile](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/compile.yml/badge.svg?branch=main)](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/compile.yml)
[![Test](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/test.yml)

</div>

This repository contains the smart contracts for the [Hedera <-> EVM Bridge](https://github.com/LimeChain/hedera-evm-bridge-validator).

- [Overview](#overview)
- [Contract Addresses & ABI](#contract-addresses--abi)
- [Development](#development)
    - [Prerequisites](#prerequisites)
    - [Compilation](#compilation)
    - [Scripts](#scripts)
        - [Router deployment](#router-deployment)
        - [Wrapped token Deployment](#wrapped-token-deployment-through-router)
    - [Tests](#tests)
        - [Unit Tests](#unit-tests)
        - [Coverage](#coverage)
- [Gas Usages](#gas-usages)

## Overview
Core functionality of [Hedera <-> EVM Bridge](https://github.com/LimeChain/hedera-evm-bridge-validator).

In essence, the business logic behind the smart contracts is to allow the possibility to transfer a token from one network to another.
Of course, you cannot directly transfer the token to the network, so in order this to be possible it has to have a representation of that token, a so-called `wrapped` version of the original `native` token.
In our terms, a `wrapped` token on a given network is a representation of a `native` token on another network. A `native` token can have `wrapped` representations on more than one `EVM` network.

Users operate with the following functionality:
* `lock` - lock a specific amount of native tokens, specifying the receiver and target network.
* `unlock` - unlock a previously locked amount of native tokens by providing an array of signatures. Signatures are verified that they are signed by the `members`.
* `mint` - mint a specific amount of wrapped tokens by providing an array of signatures, verified that they are signed by the `members`.
* `burn` - burn a specific amount of wrapped tokens.


EVM `native` tokens have to be explicitly added as supported native tokens in the smart contracts. 
Each `native` token has a service fee percentage, which will be left for the smart contract `members` upon locking/unlocking `native` tokens.
`Members` are entities, which will serve as governance whenever a user wants to get `wrapped` tokens from `native tokens` and vice versa.
Fees for `native` tokens accumulate equally between members.
`Members` need to explicitly claim (transfer) their accumulated fees for a given `native` token. 

You can read more [here](https://github.com/LimeChain/hedera-evm-bridge-validator/blob/main/docs/overview.md).

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
export INFURA_PROJECT_ID=<INFURA API project ID>
export DEPLOYER_PRIVATE_KEY=<private key to use for deployments for the specified network>
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
Deploys an instance of a [Token](./contracts/mocks/Token.sol) contract, used for testing purposes.
```bash
npx hardhat deploy-token \
    --network <network name> \
    --name <name of the token> \
    --symbol <symbol of the token> \
    --decimals <decimals of the token>
```

### Tests
#### Unit Tests
```bash
npx hardhat test
```

#### Coverage
```bash
npx hardhat coverage
```

## Gas Usages

* `lockWithPermit` 
    * Whole balance ~ 70 000 gas
    * ~ 82 000 gas

* `unlock`
    * 3 signatures ~ 118 132 gas
    * ~ 8500 gas per signature
  
* `mint`
    * 3 signatures ~ 140 223 gas
    * ~ 8500 gas per signature

* `burnWithPermit`
    * Whole balance ~ 45 127 gas
    * ~70 322 gas

* `updateMember`
    * Addition
        * 3 tokens ~ 180 000 gas (if fees for tokens have been accrued at least once)
        * ~ 35 000 gas per Token 
    * Removal
        * 3 tokens ~ 140 000 gas
        * ~ 37 000 gas per Token

`NB!` Running Unit Tests includes a gas reporter, providing metrics for method calls and deployments.
