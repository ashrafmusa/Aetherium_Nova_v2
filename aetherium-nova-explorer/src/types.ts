
import React from 'react';

// Represents a single transaction in the mempool or a block.
export interface Transaction {
    hash: string;          // Unique identifier of the transaction
    from: string;          // Public key of the sender
    to: string;            // Public key of the recipient
    amount: number;        // Amount of currency transferred
    timestamp: number;     // Time the transaction was created
    signature: string;     // Signature to verify the sender's authenticity
    type: 'TRANSFER' | 'STAKE' | 'REWARD'; // Type of the transaction
}

// Represents a transaction that has not yet been signed.
export type UnsignedTransaction = Omit<Transaction, 'hash' | 'signature'>;

// Represents a block in the blockchain.
export interface Block {
    height: number;        // The block number in the chain
    timestamp: number;     // Time the block was mined
    transactions: Transaction[]; // List of transactions included in the block
    prevHash: string;      // Hash of the previous block in the chain
    hash: string;          // Hash of the current block
    validator: string;     // Public key of the node that validated this block
    signature: string;     // Signature of the validator
}

// Represents a user's wallet.
export interface Wallet {
    publicKey: string;     // The user's public address
    secretKey: string;     // The user's private key (in a real app, this would be handled much more securely)
    balance: number;       // The user's current balance
    stakes: Stake[];       // The user's staking positions
}

// Represents a single staking position for a user.
export interface Stake {
    validatorAddress: string; // The address of the validator being staked to
    amount: number;           // The amount of currency staked
    rewards: number;          // The accumulated rewards from this stake
}

// Represents a validator node in the network.
export interface Validator {
    name: string;          // A human-readable name for the validator
    publicKey: string;     // The validator's public key
    secretKey: string;     // The validator's private key for signing blocks
    totalStake: number;    // The total amount of currency staked with this validator
    apr: number;           // The annual percentage rate for staking rewards
    rewards: number;       // The accumulated rewards for the validator
}

// Represents the overall statistics of the network.
export interface NetworkStatsData {
    blockHeight: number;   // The current height of the blockchain
    tps: number;           // Transactions per second
    activeNodes: number;   // Number of active validator nodes
}

// Represents the entire state of the network, as fetched from the node service.
export interface NetworkState {
    stats: NetworkStatsData;
    mempool: Transaction[];
    blocks: Block[];
    validators: Omit<Validator, 'secretKey'>[];
    confirmedTransactions: Transaction[];
}

// Represents the state of a single wallet, as fetched from the node service.
export interface WalletState {
    balance: number;
    stakes: Stake[];
}

// Represents a single line of output in the CLI.
export interface CliOutput {
    text: string;
    type: 'input' | 'output' | 'error' | 'success' | 'info';
}

// Represents a concept or feature of the Aetherium Nova network.
export interface Concept {
    icon: import('react').ReactNode;
    title: string;
    description: string;
}