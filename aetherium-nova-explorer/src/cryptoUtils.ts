import { sha256 } from 'js-sha256';
import { ec as EC } from 'elliptic';
import type { Transaction, UnsignedTransaction } from './types';

const ec = new EC('secp256k1');

export const getTransactionHash = (tx: UnsignedTransaction): string => {
    const txData = `${tx.from}${tx.to}${tx.amount}${tx.timestamp}${tx.type}`;
    return sha256(txData);
};

export const sign = (hash: string, secretKey: string): string => {
    const key = ec.keyFromPrivate(secretKey, 'hex');
    const signature = key.sign(hash, 'hex');
    return signature.toDER('hex');
};