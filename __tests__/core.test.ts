// __tests__/core.test.ts
import { createWallet, signTransaction, verifySignature } from '../src/wallet.js';
import { createTransaction } from '../src/utils/txUtils.js';
import { TxType, getTransactionId, getTransactionPayload } from '../src/Transaction.js';
import { GENESIS_CONFIG } from '../src/config.js';
import { calculateBlockHash, proposeBlock } from '../src/chain.js';

describe('Core Cryptographic and Transaction Logic', () => {
  it('should correctly create a new wallet', () => {
    const wallet = createWallet();
    expect(wallet).toBeDefined();
    expect(wallet.publicKey).toBeDefined();
    expect(wallet.privateKey).toBeDefined();
    expect(wallet.address).toBeDefined();
    expect(wallet.address.startsWith('0x')).toBe(true);
    expect(wallet.isEncrypted).toBe(false);
  });

  it('should correctly sign and verify a payload', () => {
    const wallet = createWallet();
    const payload = 'This is a test payload for signing.';
    const signature = signTransaction(wallet.privateKey, payload);
    const isValid = verifySignature(wallet.publicKey, payload, signature);
    expect(isValid).toBe(true);
  });

  it('should fail to verify with a wrong payload or key', () => {
    const wallet1 = createWallet();
    const wallet2 = createWallet();
    const payload = 'This is a test payload.';
    const wrongPayload = 'This is an incorrect payload.';

    const signature = signTransaction(wallet1.privateKey, payload);
    const isValidWrongPayload = verifySignature(wallet1.publicKey, wrongPayload, signature);
    expect(isValidWrongPayload).toBe(false);

    const isValidWrongKey = verifySignature(wallet2.publicKey, payload, signature);
    expect(isValidWrongKey).toBe(false);
  });

  it('should create a valid transaction and verify its signature', () => {
    const wallet = createWallet();
    const mockDetails = {
      type: TxType.TRANSFER,
      from: wallet.address,
      to: '0xabc123...',
      amount: 100,
      fee: GENESIS_CONFIG.minFee,
      nonce: 0,
      publicKey: wallet.publicKey,
    };

    const tx = createTransaction(mockDetails, wallet.privateKey);

    expect(tx).toBeDefined();
    expect(tx.timestamp).toBeDefined();
    expect(tx.signature).toBeDefined();

    // The signature is verified against the original payload, not the hash.
    const txPayload = getTransactionPayload(tx);
    const isValid = verifySignature(wallet.publicKey, txPayload, tx.signature);
    expect(isValid).toBe(true);
  });

  it('proposeBlock should accept a correctly signed block matching CLI logic', async () => {
    const wallet = createWallet();
    const lastBlock = { index: 0, hash: '0000', shardId: 0 } as any;
    const mempoolTxs = [];
    const totalFees = 0;
    const blockReward = GENESIS_CONFIG.baseReward + totalFees;
    const timestamp = Date.now();

    // CLI would create a reward transaction with the block timestamp
    const rewardTx = createRewardTransaction(wallet.address, blockReward);
    rewardTx.timestamp = timestamp;
    rewardTx.hash = getTransactionId(rewardTx);

    const blockPayload: any = {
      index: lastBlock.index + 1,
      previousHash: lastBlock.hash,
      timestamp,
      data: [...mempoolTxs, rewardTx],
      proposer: wallet.address,
      proposerPublicKey: wallet.publicKey,
      shardId: lastBlock.shardId,
    };

    const hash = calculateBlockHash(blockPayload);
    const signature = signTransaction(wallet.privateKey, hash, true);

    // now call proposeBlock passing only the mempool txs; server will append its own reward
    const result = await proposeBlock(
      mempoolTxs,
      wallet.address,
      wallet.publicKey,
      signature,
      timestamp,
      { removeTransactions: () => { } } as any
    );

    expect(result).not.toBeNull();
    expect(result?.hash).toBe(hash);
  });
});