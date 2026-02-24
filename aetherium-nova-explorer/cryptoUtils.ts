
// Post-quantum cryptography: CRYSTALS-Dilithium ML-DSA65 (NIST FIPS 204)
import { sha256 } from 'js-sha256';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import type { Transaction, Block } from './types';

// ---- Key pair generation -------------------------------------------------------
/**
 * Generates a new ML-DSA65 key pair.
 * `secretKey` is the 32-byte seed (64 hex chars) — compact and sufficient to
 * deterministically re-derive the full 4032-byte Dilithium secret key.
 */
export const generateKeyPair = (): { publicKey: string; secretKey: string } => {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const { publicKey: pubKeyBytes } = ml_dsa65.keygen(seed);
  const publicKey = Array.from(pubKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const secretKey = Array.from(seed).map(b => b.toString(16).padStart(2, '0')).join('');
  return { publicKey, secretKey };
};

// ---- Transaction hashing -------------------------------------------------------
export const getTransactionHash = (tx: Omit<Transaction, 'hash' | 'signature'>): string => {
  const txString = `${tx.from}${tx.to}${tx.amount}${tx.timestamp}${tx.type}`;
  return sha256(txString);
};

// ---- ML-DSA65 sign / verify ----------------------------------------------------
/** Signs a message string with the wallet seed (stored as "secretKey"). */
export const sign = (message: string, secretKey: string): string => {
  const seedBytes = new Uint8Array(secretKey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const { secretKey: sk } = ml_dsa65.keygen(seedBytes);
  const msgBytes = new TextEncoder().encode(message);
  const sig = ml_dsa65.sign(msgBytes, sk);
  return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Verifies an ML-DSA65 signature. */
export const verify = (message: string, signature: string, publicKey: string): boolean => {
  try {
    const pubBytes = new Uint8Array(publicKey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const sigBytes = new Uint8Array(signature.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const msgBytes = new TextEncoder().encode(message);
    return ml_dsa65.verify(sigBytes, msgBytes, pubBytes);
  } catch {
    return false;
  }
};

export const getBlockHash = (block: Omit<Block, 'hash' | 'validatorSignature'>): string => {
  const blockString = `${block.index}${block.timestamp}${block.previousHash}${block.merkleRoot}${block.validator}`;
  return sha256(blockString);
};

export const calculateMerkleRoot = (transactions: Transaction[]): string => {
  if (transactions.length === 0) {
    return '0'.repeat(64);
  }
  let tree = transactions.map(tx => tx.hash);
  while (tree.length > 1) {
    let nextLevel: string[] = [];
    for (let i = 0; i < tree.length; i += 2) {
      if (i + 1 === tree.length) {
        nextLevel.push(sha256(tree[i] + tree[i]));
      } else {
        nextLevel.push(sha256(tree[i] + tree[i + 1]));
      }
    }
    tree = nextLevel;
  }
  return tree[0];
};
