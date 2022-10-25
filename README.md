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

### Mainnet deployed contract addresses:

Ethereum:
 - `Hashport (Diamond)`: `0x367e59b559283C8506207d75B0c5D8C66c4Cd4B7`
 - `OwnershipFacet`: `0x3fad3c29973bea5e964d9d90ebb8c84cb921e6c8`
 - `GovernanceFacet`: `0x48b3d6e97a8237f51861afb7f6512fb85a52d7ee`
 - `RouterFacet`: `0xf9fe427563b12ec644e79a42b68e148273942b34`
 - `FeeCalculatorFacet`: `0x2bf0c79ce13a405a1f752f77227a28eec621f94c`
 - `DiamondCutFacet`: `0xe79c9bb508f00ab7b03cf3043929639e86626ef9`
 - `DiamondLoupeFacet`: `0x6f1fb462c6e328e8acccf59e58445a2fe18ff01e`
 - `PausableFacet`: `0x11481c1136d42c60c5bf29dfb9cb7eed90845814`
 - `GovernanceV2Facet`: `0x4AF1069ffD125f4Ce782Dc54330272CCDA42b403`
 - `PaymentFacet`: `0xF50329F6F000308538f978299cc1f670460Db514`
 - `ERC721PortalFacet`: `0x7327B01eF3bce998CA97541Ed510eC6E0D96e22B`

Polygon:
 - `Hashport (Diamond)`: `0xf4C0153A8bdB3dfe8D135cE3bE0D45e14e5Ce53D`
 - `OwnershipFacet`: `0x590243Fa41Af4383237E83a4CE5490a5AD9DacE3`
 - `GovernanceFacet`: `0x8088Cb9ba08224c7Ecff05d4b9EE32DCAac1Fabc`
 - `RouterFacet`: `0xA2F8f68d5d83f90b8401990196D0c233Dc0D4D7F`
 - `FeeCalculatorFacet`: `0x9010EE70EC5d75Be46Ba5f7366776A3C7ad9Ab1f`
 - `DiamondCutFacet`: `0x2232a10986375fdc9315F682551E141FC2A0a785`
 - `DiamondLoupeFacet`: `0x8e1E4560C1571E4aBe2Be524CE62FE398bF8CAAD`
 - `PausableFacet`: `0x9E4EAbD511acf7DC7594caBff98120139f9A43e1`
 - `GovernanceV2Facet`: `0x0381D726d3146E2171FFE48ae04BBC20A473f1B8`
 - `PaymentFacet`: `0x382D0017eb5B1301dd462172CbC0433848b0cB74`
 - `ERC721PortalFacet`: `0x2f20f10840E959Ae9dAf3DDD63534B99e7C950dA`

### ABIs

Facet ABIs are available under `./abi` directory.


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
* As a second step - the script will update the router as follows:
    * Add `PaymentFacet`
    * Add `ERC721PortalFacet`
    * Replace `GovernanceFacet` with `GovernanceV2Facet`

```bash
npx hardhat deploy-router \
    --network <network name> \
    --owner <owner address> \
    --governance-percentage <governance percentage> \
    --governance-precision <governance precision> \
    --fee-calculator-precision <fee calculator precision> \
    --members <list of members, split by `,`> \
    --members-admins <list of members admins, split by `,`>
```

#### Wrapped ERC-20 token deployment through Router
Deploys a wrapped token through Router for a corresponding token on another chain: 
```bash
npx hardhat deploy-router-wrapped-token \
    --network <network name> \
    --router <address of the router diamond contract> \
    --source <id of the source chain, to which the native token is deployed> \
    --native <the unique identifier of the native token> \
    --name <name of the wrapped token> \
    --symbol <symbol of the wrapped token> \
    --decimals <decimals of the wrapped token>
```

#### Wrapped ERC-20 token deployment
Deploys an instance of a [Wrapped Token](./contracts/WrappedToken.sol) contract, used for testing purposes.
```bash
npx hardhat deploy-wrapped-token \
    --network <network name> \
    --name <name of the token> \
    --symbol <symbol of the token> \
    --decimals <decimals of the token>
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

#### Wrapped ERC-721Pausable token deployment and Transfer Ownership to Diamond Router
Deploys a wrapped ERC-721Pausable and transfers ownership to Diamond Router
```bash
npx hardhat deploy-wrapped-erc721-pausable-transfer-ownership \
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

#### Upgrade diamond to support ERC-721
Upgrades the diamond to support ERC-721:
```bash
npx hardhat upgrade-erc721-support \
    --network <network name> \
    --router <address of the Router Diamond contract>
```

#### Set Payment Token
Requires Router Diamond Contract to be upgraded with PaymentFacet support

```bash
npx hardhat set-payment-token \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --payment-token <address of ERC-20 payment token contract> \
    --status <true|false (default true)>
```

#### Set ERC-721 Payment
Requires Router Diamond Contract to be upgraded with ERC721PortalFacet & PaymentFacet support
```bash
npx hardhat set-erc721-payment \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --erc721 <address of the ERC-721 contract> \
    --payment-token <address of the ERC-20 payment token contract> \
    --fee <required Payment Token fee upon burnERC721 wrapped transfers>
```

#### Mint Wrapped ERC-721
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

#### Burn Wrapped ERC-721
Burns Wrapped ERC-721 tokenId to the corresponding network
```bash
npx hardhat burn-erc721 \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --target-chain-id <The chain id of the target chain> \
    --wrapped-asset <The address of the wrapped ERC-721 token> \
    --token-id <The token id to be burned> \
    --receiver <The address/AccountID of the receiver>
```

#### Mint Wrapped ERC-20
Mints Wrapped ERC-20 amount to the corresponding network
```bash
npx hardhat mint-erc20 \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --source-chain-id <The chain id of the source chain> \
    --target-chain-id <The chain id of the target chain> \
    --transaction-id <The target transaction id> \
    --wrapped-asset <The address of the wrapped ERC-20 token> \
    --receiver <The address of the receiver> \
    --amount <The amount to be minted> \
    --signatures <An array of signatures, split by `,`>
```

#### Burn Wrapped ERC-20
Approves & Burns Wrapped ERC-20 amount to the corresponding network
```bash
npx hardhat burn-erc20 \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --target-chain-id <The chain id of the target chain> \
    --wrapped-asset <The address of the wrapped ERC-20 token> \
    --amount <The target amount> \
    --receiver <The address/AccountID of the receiver on the target network>
```

#### Lock Native ERC-20
Locks Native ERC-20 amount to the corresponding network
```bash
npx hardhat lock-erc20 \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --target-chain-id <The chain id of the target chain> \
    --native-asset <The address of the native ERC-20 token> \
    --amount <The amount to be locked> \
    --receiver <The address/AccountID of the receiver>
```

#### Unlock Native ERC-20
Unlocks Native ERC-20 amount to the corresponding network
```bash
npx hardhat unlock-erc20 \
    --network <network name> \
    --router <address of the Router Diamond contract> \
    --source-chain-id <The chain id of the source chain> \
    --target-chain-id <The chain id of the target chain> \
    --transaction-id <The target transaction id> \
    --native-asset <The address of the native ERC-20 token> \
    --receiver <The address of the receiver> \
    --amount <The amount to be minted> \
    --signatures <An array of signatures, split by `,`>
```

#### Transfer Ownership of a Contract
Transfers Ownership of a Contract to specified new owner.
```bash
npx hardhat transfer-ownership \
    --network <network name> \
    --contract <address of the contract> \
    --new-owner <address of the new owner>
```

### Upgrade router to support fee policy logic
Upgrade router with FeePolicyFacet with methods to handle fee policies
```bash
npx hardhat fee-policy-upgrade-router \
    --network <network name> \
    --router <address of the Router Diamond contract>
```

### Deploy FlatFeePolicy instance
Deploys a new instance of FlatFeePolicy contract
```bash
npx hardhat fee-policy-deploy-flat-fee
    --flatFee <flat fee value>
```

### Update flat fee value of FlatFeePolicy instance
Updates the value of flat fee of FlatFeePolicy contract
```bash
npx hardhat fee-policy-update-flat-fee
    --feePolicy <fee policy address>
    --flatFee <flat fee value>
```

### Deploy PercentageFeePolicy instance
Deploys a new instance of PercentageFeePolicy contract
```bash
npx hardhat fee-policy-deploy-percentage-fee
    --precision <precision value used in percentage calculations>
    --feePercentage <fee percentage value>
```

### Update precision and percentage fee value of PercentageFeePolicy instance
Updates the value of flat fee of PercentageFeePolicy contract
```bash
npx hardhat fee-policy-update-percentage-fee
    --feePolicy <fee policy address>
    --precision <precision value used in percentage calculations>
    --feePercentage <fee percentage value>
```

### Deploy FlatFeePerTokenPolicy instance
Deploys a new instance of FlatFeePerTokenPolicy contract
```bash
npx hardhat fee-policy-deploy-flat-fee-per-token
```

### Update token flat fee of FlatFeePerTokenPolicy instance
Updates the value of flat fee for specific token in FlatFeePerTokenPolicy contract
```bash
fee-policy-update-flat-fee-per-token
    --token <token address>
    --flatFee <flat fee value>
```

### Remove token flat fee from FlatFeePerTokenPolicy instance
Removes specific token from FlatFeePerTokenPolicy contract
```bash
fee-policy-remove-flat-fee-per-token
    --token <token address>
```

### Set user address to fee policy
Sets user addresses to use specific policy
```bash
npx hardhat fee-policy-set-users-to-policy
    --router <address of the Router Diamond contract>
    --feePolicy <fee policy address>
    --addresses <user addresses separated by comma (",")>
```

### Remove user addresses from fee policy
Removes user addresses from policy
```bash
npx hardhat fee-policy-remove-users-from-policy
    --router <address of the Router Diamond contract>
    --addresses <user addresses separated by comma (",")>
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
