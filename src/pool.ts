import { verifyTransaction, getTransactionId, type Transaction, TxType } from "./Transaction.js";
import { getBalance, getNonceForAddress, getContractCode } from "./ledger.js";
import { GENESIS_CONFIG } from "./config.js";
import logger from "./logger.js";

class Mempool {
  private pool: Transaction[] = [];
  private seenTxIds = new Set<string>();

  constructor() {
    setInterval(() => this.pruneExpiredTransactions(), GENESIS_CONFIG.transactionPruneInterval || 60000);
  }

  public addToPool(tx: Transaction): { success: boolean; message: string } {
    const txId = getTransactionId(tx);

    if (this.seenTxIds.has(txId)) {
      return { success: false, message: "Duplicate transaction." };
    }

    if (!verifyTransaction(tx)) {
      logger.warn(`[Mempool] Rejected invalid transaction from ${tx.from}. TxId: ${txId}`);
      return { success: false, message: "Invalid transaction signature or structure." };
    }

    if (getBalance(tx.from) < tx.amount + tx.fee) {
      logger.warn(`[Mempool] Rejected transaction due to insufficient balance for ${tx.from}. TxId: ${txId}`);
      return { success: false, message: "Insufficient balance." };
    }

    if (getNonceForAddress(tx.from) !== tx.nonce) {
      logger.warn(`[Mempool] Rejected transaction due to invalid nonce for ${tx.from}. Expected: ${getNonceForAddress(tx.from)}, Got: ${tx.nonce}. TxId: ${txId}`);
      return { success: false, message: "Invalid nonce." };
    }

    if (tx.type === TxType.CALL || tx.type === TxType.DEPLOY) {
      if (!tx.to || typeof tx.to !== 'string') {
        logger.warn(`[Mempool] Rejected contract transaction with invalid 'to' address. TxId: ${txId}`);
        return { success: false, message: "Invalid contract address." };
      }
      if (tx.type === TxType.CALL && !getContractCode(tx.to)) {
        logger.warn(`[Mempool] Rejected CALL to non-existent contract ${tx.to}. TxId: ${txId}`);
        return { success: false, message: "Target contract does not exist." };
      }
      // tx.data.code is now populated by node.ts, not cli.ts
      if (tx.type === TxType.DEPLOY && !tx.data?.code) { 
        logger.warn(`[Mempool] Rejected DEPLOY transaction without contract code. TxId: ${txId}`);
        return { success: false, message: "Deploy transaction missing contract code." };
      }
    }

    this.pool.push(tx);
    this.seenTxIds.add(txId);
    logger.info(`[Mempool] Transaction ${txId} added to pool.`);
    return { success: true, message: "Transaction accepted." };
  }

  public getPool(): Transaction[] { return [...this.pool]; }

  public removeTransactions(txsToRemove: Transaction[]): void {
    const idsToRemove = new Set(txsToRemove.map(getTransactionId));
    const initialSize = this.pool.length;
    this.pool = this.pool.filter(tx => !idsToRemove.has(getTransactionId(tx)));
    const removedCount = initialSize - this.pool.length;
    if (removedCount > 0) {
      logger.info(`[Mempool] Removed ${removedCount} transactions from pool after mining.`);
    }
    idsToRemove.forEach(id => this.seenTxIds.delete(id));
  }
  
  public pruneExpiredTransactions(): void {
    const now = Date.now();
    const initialSize = this.pool.length;
    this.pool = this.pool.filter(tx => (now - tx.timestamp) < (GENESIS_CONFIG.transactionTTL || 300000));
    const removedCount = initialSize - this.pool.length;
    if (removedCount > 0) {
      logger.info(`[Mempool] Pruned ${removedCount} expired transaction(s).`);
      const currentTxIds = new Set(this.pool.map(getTransactionId));
      this.seenTxIds.forEach(id => {
        if (!currentTxIds.has(id)) {
          this.seenTxIds.delete(id);
        }
      });
    }
  }
}

const mempoolInstance = new Mempool();
export default mempoolInstance;