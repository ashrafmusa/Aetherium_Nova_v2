import { verifyTransaction, getTransactionId, type Transaction, TxType } from "./Transaction.js";
import { getBalance, getNonceForAddress, getContractCode } from "./ledger.js";
import { GENESIS_CONFIG } from "./config.js";
import { getLogger } from "./logger.js";

const log = getLogger();

class Mempool {
  private pool: Transaction[] = [];
  private seenTxIds = new Set<string>();

  constructor() {
    setInterval(() => this.pruneExpiredTransactions(), GENESIS_CONFIG.transactionPruneInterval || 60000);
  }

  public addToPool(tx: Transaction): { success: boolean; message: string } {
    const txId = getTransactionId(tx);

    // 1. Max Pool Size Check (DoS Protection)
    if (this.pool.length >= (GENESIS_CONFIG.maxMempoolSize ?? 5000)) {
      return { success: false, message: "Mempool is full." };
    }

    // 2. Min Fee Check (Spam Protection)
    if (tx.fee < (GENESIS_CONFIG.minFee ?? 0.001)) {
      return { success: false, message: "Transaction fee too low." };
    }

    // Cap seenTxIds to prevent unbounded memory growth (DoS protection)
    if (this.seenTxIds.size >= 50000) {
      // Evict the oldest 25k entries (Set preserves insertion order)
      let pruned = 0;
      for (const id of this.seenTxIds) {
        this.seenTxIds.delete(id);
        if (++pruned >= 25000) break;
      }
    }

    if (this.seenTxIds.has(txId)) {
      return { success: false, message: "Duplicate transaction." };
    }

    if (!verifyTransaction(tx)) {
      log.warn(`[Mempool] Rejected invalid transaction from ${tx.from}. TxId: ${txId}`);
      return { success: false, message: "Invalid transaction signature or structure." };
    }

    if (getBalance(tx.from) < tx.amount + tx.fee) {
      log.warn(`[Mempool] Rejected transaction due to insufficient balance for ${tx.from}. TxId: ${txId}`);
      return { success: false, message: "Insufficient balance." };
    }

    if (getNonceForAddress(tx.from) !== tx.nonce) {
      log.warn(`[Mempool] Rejected transaction due to invalid nonce for ${tx.from}. Expected: ${getNonceForAddress(tx.from)}, Got: ${tx.nonce}. TxId: ${txId}`);
      return { success: false, message: "Invalid nonce." };
    }

    if (tx.type === TxType.CALL || tx.type === TxType.DEPLOY) {
      if (!tx.to || typeof tx.to !== 'string') {
        log.warn(`[Mempool] Rejected contract transaction with invalid 'to' address. TxId: ${txId}`);
        return { success: false, message: "Invalid contract address." };
      }
      if (tx.type === TxType.CALL && !getContractCode(tx.to)) {
        log.warn(`[Mempool] Rejected CALL to non-existent contract ${tx.to}. TxId: ${txId}`);
        return { success: false, message: "Target contract does not exist." };
      }
      // tx.data.code is now populated by node.ts, not cli.ts
      if (tx.type === TxType.DEPLOY && !tx.data?.code) {
        log.warn(`[Mempool] Rejected DEPLOY transaction without contract code. TxId: ${txId}`);
        return { success: false, message: "Deploy transaction missing contract code." };
      }
    }

    this.pool.push(tx);
    this.seenTxIds.add(txId);
    log.info(`[Mempool] Transaction ${txId} added to pool.`);
    return { success: true, message: "Transaction accepted." };
  }

  public contains(txId: string): boolean {
    return this.seenTxIds.has(txId);
  }

  public getPool(): Transaction[] { return [...this.pool]; }

  public removeTransactions(txsToRemove: Transaction[]): void {
    const idsToRemove = new Set(txsToRemove.map(getTransactionId));
    const initialSize = this.pool.length;
    // Pre-compute pool IDs once to avoid redundant SHA-256 hashing inside filter
    const remaining: Transaction[] = [];
    for (const tx of this.pool) {
      if (!idsToRemove.has(getTransactionId(tx))) {
        remaining.push(tx);
      }
    }
    this.pool = remaining;
    const removedCount = initialSize - this.pool.length;
    if (removedCount > 0) {
      log.info(`[Mempool] Removed ${removedCount} transactions from pool after mining.`);
    }
    idsToRemove.forEach(id => this.seenTxIds.delete(id));
  }

  public pruneExpiredTransactions(): void {
    const now = Date.now();
    const initialSize = this.pool.length;
    this.pool = this.pool.filter(tx => (now - tx.timestamp) < (GENESIS_CONFIG.transactionTTL || 300000));
    const removedCount = initialSize - this.pool.length;
    if (removedCount > 0) {
      log.info(`[Mempool] Pruned ${removedCount} expired transaction(s).`);
      const currentTxIds = new Set(this.pool.map(getTransactionId));
      this.seenTxIds.forEach(id => {
        if (!currentTxIds.has(id)) {
          this.seenTxIds.delete(id);
        }
      });
    }
  }
}

export { Mempool };