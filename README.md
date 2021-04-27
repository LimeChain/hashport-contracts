<div align="center">

# Hedera <-> Ethereum Bridge Contracts

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Compile](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/compile.yml/badge.svg?branch=main)](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/compile.yml)
[![Test](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/LimeChain/hedera-eth-bridge-contracts/actions/workflows/test.yml)

</div>

This repository contains the smart contracts for the Hedera <-> Ethereum bridge.
Contracts consist of `ERC20` representaitons of Hedera Assets and `Router` contract, responsible for the minting/burning of tokens.

## Contract Addresses & ABI

This is a WIP and the contracts have not been deployed yet.

## Development

`hardhat` - framework used for the development and testing of the contracts

### Compilation

Before you deploy the contracts, you will need to compile them using:

```
npx hardhat compile
```

### Scripts

#### Eth deployment - local

```
npx hardhat deploy
```

#### Eth deployment

```
npx hardhat deploy --network 'network name or id'
```

### Deploy for testnet with n members

-   Deploys the ERC20 representation of HBAR Asset (WHBAR) and Router contract
-   Generates three member accounts and sends them 0.3 ethers

-   Sets the required validators to be members of the Router contract
-   Prints out WHBAR, Router, members addresses

#### How to run:

```
npx hardhat deploy-testnet --members /The count od the members set in the contract/ --network /The name of the network/
```

#### Deploy Token

```
npx hardhat deploy-token --controller /The address of the deployed controller contract/ --name /Token name/ --symbol /Token symbol/ --decimals /Token decimals/ --network /The name of the network/
```

#### Add token pair

```
npx hardhat add-pair --router /The address of the deployed router/ --native /hedera token id/ --wrapped /The address of the deployed token/ --network /The name of the network/
```

#### Remove token pair

```
npx hardhat remove-pair --router /The address of the deployed router/ --native /hedera token id/ --wrapped /The address of the deployed token/ --network /The name of the network/
```

#### UpdateMember

```
npx hardhat update-member --router /The address of the deployed router contract/ --member /The address of the member/ --status /Status of the member/ --network /The name of the network/

```
