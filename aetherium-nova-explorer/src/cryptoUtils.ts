// Post-quantum cryptography: CRYSTALS-Dilithium ML-DSA65 (NIST FIPS 204)
import { sha256 } from 'js-sha256';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import type { Transaction, UnsignedTransaction } from './types';

export const getTransactionHash = (tx: UnsignedTransaction): string => {
    const txData = `${tx.from}${tx.to}${tx.amount}${tx.timestamp}${tx.type}`;
    return sha256(txData);
};

/** Signs a message string with the wallet seed (stored as "secretKey"). */
export const sign = (message: string, secretKey: string): string => {
    const seedBytes = new Uint8Array(secretKey.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const { secretKey: sk } = ml_dsa65.keygen(seedBytes);
    const msgBytes = new TextEncoder().encode(message);
    const sig = ml_dsa65.sign(msgBytes, sk);
    return Array.from(sig).map(b => (b as number).toString(16).padStart(2, '0')).join('');
};