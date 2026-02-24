import { calculateBlockHash } from '../dist/chain.js';
import { createRewardTransaction } from '../dist/Transaction.js';
import { getTransactionId } from '../dist/Transaction.js';
import { TxType } from '../dist/Transaction.js';

function cliCompute(pendingTxs, lastBlock, minerAddress, minerPubKey) {
  const transactionsToInclude = pendingTxs.slice(0, 5); // arbitrary limit
  const totalFees = transactionsToInclude.reduce((sum, tx) => sum + tx.fee, 0);
  const blockReward = 50 + totalFees;
  const timestamp = Date.now();
  const rewardTx = createRewardTransaction(minerAddress, blockReward);
  rewardTx.timestamp = timestamp;
  rewardTx.hash = getTransactionId(rewardTx);
  const finalTxs = [...transactionsToInclude, rewardTx];
  const blockPayload = {
    index: lastBlock.index + 1,
    previousHash: lastBlock.hash,
    timestamp,
    data: finalTxs,
    proposer: minerAddress,
    proposerPublicKey: minerPubKey,
    shardId: lastBlock.shardId,
  };
  const hash = calculateBlockHash(blockPayload);
  return { blockPayload, hash };
}

function serverCompute(pendingTxs, lastBlock, minerAddress, minerPubKey, timestamp) {
  const mempoolTxs = pendingTxs.filter(tx => tx.type !== TxType.REWARD);
  const transactionsToInclude = mempoolTxs.slice(0, 5);
  const totalFees = transactionsToInclude.reduce((sum, tx) => sum + tx.fee, 0);
  const blockReward = 50 + totalFees;
  const rewardTx = createRewardTransaction(minerAddress, blockReward);
  rewardTx.timestamp = timestamp;
  rewardTx.hash = getTransactionId(rewardTx);
  const finalTxs = [...transactionsToInclude, rewardTx];
  const blockData = {
    index: lastBlock.index + 1,
    previousHash: lastBlock.hash,
    timestamp: timestamp,
    data: finalTxs,
    proposer: minerAddress,
    proposerPublicKey: minerPubKey,
    shardId: lastBlock.shardId,
  };
  const hash = calculateBlockHash(blockData);
  return { blockData, hash };
}

// simulate
const dummyTxs = [{ type: TxType.TRANSFER, from: 'a', to: 'b', amount: 10, fee: 1, nonce: 0, timestamp: Date.now(), signature:'sig', publicKey:'pub', hash:'h1' }];
const lastBlock = { index: 0, hash: '0000', shardId: 0 };
const minerAddress = '0xminer';
const minerPub = '0xpub';

const { blockPayload, hash: cliHash } = cliCompute(dummyTxs, lastBlock, minerAddress, minerPub);
const { blockData, hash: srvHash } = serverCompute(blockPayload.data, lastBlock, minerAddress, minerPub, blockPayload.timestamp);

console.log('cliHash', cliHash);
console.log('srvHash', srvHash);
console.log('equal?', cliHash === srvHash);
