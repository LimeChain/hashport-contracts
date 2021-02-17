<div align="center">

# Hedera <-> Ethereum Bridge Contracts

</div>

This repository contains the smart contracts for the Hedera <-> Ethereum bridge.
Contracts consist of the ERC20 WHBAR and the Bridge contract responsible for the minting/burning of tokens.

UML Diagrams for the main contracts:

<div align="center">

![bridge](/images/bridge.png "Bridge contract") 

![governance](/images/gov.png "Governance contract") 

</div>

## Contract Addresses & ABI
This is a WIP and the contracts have not been deployed yet.

## Development
`etherlime` - framework used for the development and testing of the contracts

### Compilation
Before you deploy the contracts, you will need to compile them using:
```
etherlime compile --solcVersion 0.6.0
```

### Scripts

#### Eth deployment - local

```
etherlime deploy
```

#### Eth deployment

```
etherlime deploy --network 'network' --secret '0x..'
```

#### Hedera deployment (3 accounts + topic)

```
OPERATOR_KEY=... OPERATOR_ID=... node ./scripts/hedera-deploy.js
```