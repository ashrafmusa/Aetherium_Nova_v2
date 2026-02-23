// src/Transaction.ts (Final Corrected Version)

import crypto from "crypto";
import { signTransaction, verifySignature, generateAddress } from "./wallet.js";
import { GENESIS_CONFIG } from "./config.js";
import { getLogger } from './logger.js';

const log = getLogger();

export enum TxType {
  TRANSFER = "TRANSFER",
  DEPLOY = "DEPLOY",
  CALL = "CALL",
  STAKE = "STAKE",
  UNSTAKE = "UNSTAKE",
  CLAIM_REWARDS = "CLAIM_REWARDS",
  REWARD = "REWARD"
}

export interface TransactionData {
  code?: string;
  method?: string;
  params?: any[];
  contractFilePath?: string;
  contractClassName?: string;
}

export interface Transaction {
  type: TxType;
  from: string;
  to: string;
  amount: number;
  fee: number;
  nonce: number;
  timestamp: number;
  data?: TransactionData;
  signature: string;
  publicKey: string;
  hash: string;
}

export function createRewardTransaction(recipientAddress: string, amount: number): Transaction {
  const timestamp = Date.now();

  return {
    type: TxType.REWARD,
    from: 'coinbase',
    to: recipientAddress,
    amount: amount,
    fee: 0,
    nonce: -1, // Rewards don't have a nonce in the same way
    timestamp: timestamp,
    data: undefined,
    signature: '0'.repeat(128), // Placeholder
    publicKey: '0'.repeat(130), // Placeholder
    hash: '' // Placeholder, will be calculated later
  };
}

export function getTransactionPayload(transaction: Partial<Transaction>): string {
  const dataString = transaction.data !== undefined ? JSON.stringify(transaction.data) : '';
  const payload = `${transaction.type}:${transaction.from}:${transaction.to}:${transaction.amount}:${transaction.fee}:${transaction.nonce}:${transaction.timestamp}:${dataString}:${transaction.publicKey}`;
  return payload;
}

export function getTransactionId(transaction: Transaction): string {
  return crypto.createHash("sha256").update(getTransactionPayload(transaction)).digest("hex");
}

// Deterministic contract address derivation — identical inputs always yield identical address.
// Using only creatorAddress + nonce (like Ethereum's CREATE opcode) ensures all nodes agree.
export function generateContractAddress(creatorAddress: string, nonce: number): string {
  const hashInput = JSON.stringify({ creatorAddress, nonce });
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

export function verifyTransaction(tx: Transaction): boolean {
  if (tx.from === "coinbase" && tx.type === TxType.REWARD) {
    return true;
  }
  if (tx.from === "coinbase" && tx.type !== TxType.REWARD) {
    log.warn(`[TxValidation] Rejected invalid coinbase transaction type: ${tx.type}`);
    return false;
  }

  if (!tx.signature || !tx.publicKey || !tx.type || !tx.from || !tx.to) {
    log.warn(`[TxValidation] Rejected transaction with missing critical fields. Type: ${tx.type}, From: ${tx.from}`);
    return false;
  }
  if (tx.amount < 0 || tx.fee < 0 || tx.nonce < 0) {
    log.warn(`[TxValidation] Rejected transaction with negative amount, fee, or nonce. From: ${tx.from}`);
    return false;
  }
  if (tx.fee < GENESIS_CONFIG.minFee) {
    log.warn(`[TxValidation] Rejected transaction below minimum fee. From: ${tx.from}, Fee: ${tx.fee}`);
    return false;
  }

  const timeSkew = Date.now() - tx.timestamp;
  if (Math.abs(timeSkew) > GENESIS_CONFIG.transactionTTL) {
    log.warn(`[TxValidation] Rejected expired or future transaction. From: ${tx.from}, Skew: ${timeSkew}ms`);
    return false;
  }

  const derivedAddress = generateAddress(tx.publicKey);
  if (tx.from !== derivedAddress) {
    log.warn(`[TxValidation] Rejected transaction: 'from' address does not match public key. Tx.from: ${tx.from}, Derived: ${derivedAddress}`);
    return false;
  }

  const payloadForVerification = getTransactionPayload(tx);

  if (!verifySignature(tx.publicKey, payloadForVerification, tx.signature)) {
    log.warn(`[TxValidation] Rejected transaction: invalid signature. From: ${tx.from}, TxId: ${getTransactionId(tx)}`);
    return false;
  }

  if (tx.type === TxType.STAKE && tx.amount < (GENESIS_CONFIG.minStake ?? 0)) {
    log.warn(`[TxValidation] Rejected STAKE transaction below minimum stake amount. Required: ${GENESIS_CONFIG.minStake}, Got: ${tx.amount}`);
    return false;
  }

  if (!Object.values(TxType).includes(tx.type)) {
    log.warn(`[TxValidation] Rejected transaction with unknown type: ${tx.type}`);
    return false;
  }

  return true;
}