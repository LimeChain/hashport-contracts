# hedera-eth-bridge-contracts

## Prerequisites

`etherlime`

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
