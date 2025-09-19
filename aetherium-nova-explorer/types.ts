
import type { ReactNode } from 'react';

export interface Concept {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface NetworkStatsData {
  blockHeight: number;
  tps: number;
  activeNodes: number;
  marketCap: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  type: 'TRANSFER' | 'STAKE' | 'REWARD';
  signature: string; 
}

export type UnsignedTransaction = Omit<Transaction, 'hash' | 'signature'>;

export interface Block {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  validator: string;
  previousHash: string;
  merkleRoot: string;
  hash: string;
  validatorSignature: string;
}

export interface Stake {
  validatorAddress: string;
  amount: number;
  rewards: number;
}

export interface Wallet {
  publicKey: string;
  secretKey: string;
  balance: number;
  stakes: Stake[];
}

export interface Validator {
    publicKey: string;
    secretKey: string;
    name: string;
    totalStake: number;
    apr: number;
    icon: ReactNode;
}

export interface CliOutput {
  text: string;
  type: 'input' | 'output' | 'error' | 'success' | 'info';
}

// Type for data fetched from the "Node API"
export interface NetworkState {
    stats: NetworkStatsData;
    blocks: Block[];
    mempool: Transaction[];
    validators: Omit<Validator, 'secretKey'>[];
}
