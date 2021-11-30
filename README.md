<div align="center">

# Hashport Contracts

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
export ALCHEMY_PROJECT_ID=<PROJECT ID of ALCHEMY>
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
    --members <list of members, split by `,`>
    --members-admins <list of members admins, split by `,`>
```

#### Wrapped ERC-20 token deployment through Router
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

#### Wrapped ERC-721 token deployment and Transfer Ownership to Diamond Router
Deploys a wrapped ERC-721 and transfers ownership to Diamond Router
```bash
npx hardhat deploy-wrapped-erc721-transfer-ownership \
    --network <network name> \
    --router <address of the router diamond contract> \
    --name <name of the ERC-721> \
    --symbol <symbol of the ERC-721>
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

#### Update Native Token to Router
Updates a native token to the Router contract:
```bash
npx hardhat update-native-token \
    --network <network name> \
    --router <address of the router diamond contract> \
    --native-token <address of the native token> \
    --fee-percentage <fee percetange for the given token> \
    --status <true|false (default true)>
```

### Upgrade diamond to support ERC-721
Upgrades the diamond to support ERC-721:
```bash
npx hardhat upgrade-erc721-support \
    --network <network name> \
    --router <address of the Router Diamond contract>
```

### Set Payment Token
Requires Router Diamond Contract to be upgraded with PaymentFacet support

```bash
npx hardhat set-payment-token \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --payment-token <address of ERC-20 payment token contract> \
    --status <true|false (default true)>
```

## Set ERC-721 Payment
Requires Router Diamond Contract to be upgraded with ERC721PortalFacet & PaymentFacet support
```bash
npx hardhat set-erc721-payment \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --erc721 <address of the ERC-721 contract> \
    --payment-token <address of the ERC-20 payment token contract> \
    --fee <required Payment Token fee upon burnERC721 wrapped transfers>
```

## Mint Wrapped ERC-721
Requires Router Diamond Contract to support ERC721PortalFacet
Mints Wrapped ERC-721 tokenID to the corresponding network
```bash
npx hardhat mint-erc721 \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --source-chain-id <The chain id of the source chain> \
    --target-chain-id <The chain id of the target chain> \
    --transaction-id <The target transaction id> \
    --wrapped-asset <The address of the wrapped ERC-721 token> \
    --token-id <The target token ID to be minted> \
    --metadata <The token ID metadata> \
    --receiver <The address of the receiver> \
    --signatures <An array of signatures, split by `,`>
```

## Mint Wrapped ERC-20
Mints Wrapped ERC-20 amount to the corresponding network
```bash
npx hardhat mint-erc20 \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --source-chain-id <The chain id of the source chain> \
    --target-chain-id <The chain id of the target chain> \
    --transaction-id <The target transaction id> \
    --wrapped-asset <The address of the wrapped ERC-721 token> \
    --receiver <The address of the receiver> \
    --amount <The amount to be minted> \
    --signatures <An array of signatures, split by `,`>
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
