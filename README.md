# hedera-eth-bridge-contracts

## Prerequisites
`etherlime`

### Compilation
Before you deploy the contracts, you will need to compile them using:
```
etherlime compile
```

### Scripts
#### Eth deployment
```
PRIVATE_KEY=0x... NETWORK=... API_KEY=... node ./scripts/eth-deploy.js
```

#### Hedera deployment (3 accounts + topic)
```
OPERATOR_KEY=... OPERATOR_ID=... node ./scripts/hedera-deploy.js
```
