const {
  Client,
  PrivateKey,
  KeyList,
  AccountCreateTransaction,
  TopicCreateTransaction,
  Hbar,
  AccountId,
} = require("@hashgraph/sdk");

async function createAccount(client) {
  const newKey = PrivateKey.generate();

  console.log(`private key = ${newKey}`);
  console.log(`public key = ${newKey.publicKey}`);

  const response = await new AccountCreateTransaction()
    .setInitialBalance(new Hbar(100)) // 100 h
    .setKey(newKey.publicKey)
    .execute(client);

  const receipt = await response.getReceipt(client);

  console.log(`account id = ${receipt.accountId}, public key = ${newKey.publicKey}`);

  return newKey.publicKey;
}

async function main() {
  let client;

  if (process.env.OPERATOR_KEY == null || process.env.OPERATOR_ID == null) {
    console.log('missing input parameters');
    return;
  }

  switch (process.env.HEDERA_NETWORK) {
    case "mainnet":
      client = Client.forMainnet();
      break;
    case "previewnet":
      client = Client.forPreviewnet();
      break;
    default:
      client = Client.forTestnet();
  }

  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
  const operatorId = AccountId.fromString(process.env.OPERATOR_ID);

  client.setOperator(operatorId, operatorKey);

  const publicKeys = await Promise.all([createAccount(client), createAccount(client), createAccount(client)]);

  const thresholdKey = new KeyList(publicKeys, 1);

  const response = await new TopicCreateTransaction()
    .setSubmitKey(thresholdKey)
    .execute(client);

  const receipt = await response.getReceipt(client);
  console.log(`topic id = ${receipt.topicId}`);
}

void main();
