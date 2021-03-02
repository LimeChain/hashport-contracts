# Deployment Scripts

## Deploy for testnet

Deploys the WHBAR token and Governance contracts
Generates 3 member accounts and send them 0.1 ethers
Sets the required validators to be members of the Governance contract
Prints out WHBAR, Bridge, Alice, Bob and Carol Wallets

### How to run

1. etherlime compile --solcVersion 0.6.0
2. etherlime deploy ./deployment/testnet-env-deployments.js --compile false --network /network name or id/ --secret /your private key/
