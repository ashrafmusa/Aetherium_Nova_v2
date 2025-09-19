// src/utils/txUtils.ts (Corrected)
import { signTransaction } from "../wallet.js";
import { Transaction, getTransactionPayload } from "../Transaction.js";

/**
 * Creates and signs a transaction.
 * @param details The transaction details without timestamp or signature.
 * @param privateKey The private key to sign the transaction.
 * @returns The complete, signed transaction.
 */
export function createTransaction(
  details: Omit<Transaction, 'timestamp' | 'signature'>,
  privateKey: string,
): Transaction {
  const timestamp = Date.now();
  const txToSign: Partial<Transaction> = { ...details, timestamp };
  const payload = getTransactionPayload(txToSign);
  const signature = signTransaction(privateKey, payload);
  return { ...details, timestamp, signature };
}