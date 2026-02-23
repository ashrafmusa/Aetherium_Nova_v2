import { Transaction } from './Transaction.js';

export interface Block {
    index: number;
    previousHash: string;
    timestamp: number;
    data: Transaction[];
    hash: string;
    proposer: string;
    proposerPublicKey: string;
    signature: string;
    shardId?: number;
}