
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
  /** On-chain address — used as the primary lookup key */
  publicKey: string;
  secretKey?: string;
  name: string;
  totalStake: number;
  apr: number;
  icon?: ReactNode;
  jailed?: boolean;
  slashCount?: number;
  delegatorCount?: number;
  lastProposedBlock?: number | null;
}

export type SearchResultType = 'block' | 'address' | 'transaction';

export interface SearchResult {
  type: SearchResultType;
  data: {
    // block
    index?: number;
    hash?: string;
    timestamp?: number;
    transactions?: Transaction[];
    previousHash?: string;
    // address
    address?: string;
    balance?: number;
    nonce?: number;
    // transaction
    tx?: Transaction;
    blockIndex?: number | null;
    confirmed?: boolean;
  };
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
export interface WalletState {
  balance: number;
  stakes: Stake[];
}
