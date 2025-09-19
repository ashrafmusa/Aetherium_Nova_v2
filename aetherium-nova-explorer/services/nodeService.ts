
import React from 'react';
import type { Transaction, Block, Validator, NetworkState, UnsignedTransaction, NetworkStatsData, Stake } from '../types';
import { generateKeyPair, getTransactionHash, sign, getBlockHash, calculateMerkleRoot, verify } from '../cryptoUtils';
import { ServerIcon } from '../components/icons/ServerIcon';

// --- INTERNAL STATE (SIMULATED BACKEND DATABASE) ---

const MOCK_VALIDATORS_DATA = [
    // FIX: Replaced <ServerIcon /> with React.createElement(ServerIcon) to avoid JSX parsing errors in a .ts file.
    { name: "Quantum Leap Validator", totalStake: 12_500_000, apr: 5.5, icon: React.createElement(ServerIcon) },
    // FIX: Replaced <ServerIcon /> with React.createElement(ServerIcon) to avoid JSX parsing errors in a .ts file.
    { name: "Cosmic Node Solutions", totalStake: 10_200_000, apr: 5.8, icon: React.createElement(ServerIcon) },
    // FIX: Replaced <ServerIcon /> with React.createElement(ServerIcon) to avoid JSX parsing errors in a .ts file.
    { name: "Cypher-State Digital", totalStake: 8_900_000, apr: 6.1, icon: React.createElement(ServerIcon) },
    // FIX: Replaced <ServerIcon /> with React.createElement(ServerIcon) to avoid JSX parsing errors in a .ts file.
    { name: "Nova Syndicate", totalStake: 15_100_000, apr: 5.2, icon: React.createElement(ServerIcon) },
    // FIX: Replaced <ServerIcon /> with React.createElement(ServerIcon) to avoid JSX parsing errors in a .ts file.
    { name: "Pioneer Staking", totalStake: 7_500_000, apr: 6.5, icon: React.createElement(ServerIcon) },
    // FIX: Replaced <ServerIcon /> with React.createElement(ServerIcon) to avoid JSX parsing errors in a .ts file.
    { name: "Aether Stake Pool", totalStake: 11_300_000, apr: 5.7, icon: React.createElement(ServerIcon) },
];

let validators: Validator[] = MOCK_VALIDATORS_DATA.map(v => ({...v, ...generateKeyPair()}));

const GENESIS_BLOCK: Block = {
    index: 0,
    timestamp: 1672531200000,
    transactions: [],
    validator: '0'.repeat(64),
    previousHash: '0'.repeat(64),
    merkleRoot: '0'.repeat(64),
    hash: '0'.repeat(64),
    validatorSignature: '0'.repeat(128),
};
GENESIS_BLOCK.merkleRoot = calculateMerkleRoot(GENESIS_BLOCK.transactions);
GENESIS_BLOCK.hash = getBlockHash(GENESIS_BLOCK);

let blocks: Block[] = [GENESIS_BLOCK];
let mempool: Transaction[] = [];
let stats: NetworkStatsData = {
    blockHeight: 0,
    tps: 0,
    activeNodes: validators.length,
    marketCap: 420_123_456_789,
};

// publicKey -> { balance, stakes }
let accounts = new Map<string, { balance: number; stakes: Stake[] }>();

// --- SIMULATION LOGIC ---

function runBlockCreation() {
    setInterval(() => {
        if (mempool.length === 0) return;
        
        const validMempool = mempool.filter(tx => verify(tx.hash, tx.signature, tx.from));
        const transactionsForBlock = validMempool.slice(0, 20);
        if (transactionsForBlock.length === 0) {
            mempool = mempool.slice(validMempool.length); // Clear out invalid txs
            return;
        };

        const validator = validators[Math.floor(Math.random() * validators.length)];
        const previousBlock = blocks[0];
        
        const newBlockData: Omit<Block, 'hash' | 'validatorSignature'> = {
            index: previousBlock.index + 1,
            timestamp: Date.now(),
            transactions: transactionsForBlock,
            validator: validator.publicKey,
            previousHash: previousBlock.hash,
            merkleRoot: calculateMerkleRoot(transactionsForBlock),
        };

        const blockHash = getBlockHash(newBlockData);
        const validatorSignature = sign(blockHash, validator.secretKey);

        const finalBlock: Block = { ...newBlockData, hash: blockHash, validatorSignature: validatorSignature };

        blocks = [finalBlock, ...blocks.slice(0, 99)]; // Keep last 100 blocks
        mempool = mempool.slice(transactionsForBlock.length);
        
        // Process transactions to update account balances
        for (const tx of transactionsForBlock) {
            const fromAccount = accounts.get(tx.from) || { balance: 0, stakes: [] };
            const toAccount = accounts.get(tx.to) || { balance: 0, stakes: [] };

            if(tx.type === 'TRANSFER') {
                fromAccount.balance -= tx.amount;
                toAccount.balance += tx.amount;
            } else if (tx.type === 'STAKE') {
                fromAccount.balance -= tx.amount;
                const existingStake = fromAccount.stakes.find(s => s.validatorAddress === tx.to);
                if(existingStake) {
                    existingStake.amount += tx.amount;
                } else {
                    fromAccount.stakes.push({ validatorAddress: tx.to, amount: tx.amount, rewards: 0 });
                }
                 const stakedValidator = validators.find(v => v.publicKey === tx.to);
                 if(stakedValidator) {
                    stakedValidator.totalStake += tx.amount;
                 }
            }
            accounts.set(tx.from, fromAccount);
            accounts.set(tx.to, toAccount);
        }

        stats = {
            ...stats,
            blockHeight: finalBlock.index,
            tps: transactionsForBlock.length / 3,
            marketCap: stats.marketCap + (Math.random() - 0.45) * 1000000,
        };

    }, 3000);
}

function runStakingRewards() {
    setInterval(() => {
        for (const [publicKey, account] of accounts.entries()) {
            if (account.stakes.length > 0) {
                const newStakes = account.stakes.map(stake => {
                    const validator = validators.find(v => v.publicKey === stake.validatorAddress);
                    if (!validator) return stake;
                    const rewardPerSecond = (stake.amount * (validator.apr / 100)) / (365 * 24 * 60 * 60);
                    return { ...stake, rewards: stake.rewards + rewardPerSecond * 5 }; // 5s interval
                });
                accounts.set(publicKey, { ...account, stakes: newStakes });
            }
        }
    }, 5000);
}

runBlockCreation();
runStakingRewards();


// --- MOCK API ENDPOINTS ---

const apiDelay = <T,>(data: T, delay = 200): Promise<T> => 
    new Promise(resolve => setTimeout(() => resolve(JSON.parse(JSON.stringify(data))), delay));

export const nodeService = {
    getNetworkState: (): Promise<NetworkState> => {
        const publicValidators = validators.map(({ secretKey, ...rest }) => rest);
        return apiDelay({
            stats,
            blocks,
            mempool,
            validators: publicValidators,
        });
    },

    submitTransaction: (tx: Transaction): Promise<{ success: boolean; message: string }> => {
        // Basic validation
        if (!tx.from || !tx.to || !tx.amount || !tx.signature || !tx.hash) {
            return Promise.resolve({ success: false, message: 'Invalid transaction data.' });
        }
        if (mempool.find(t => t.hash === tx.hash)) {
            return Promise.resolve({ success: false, message: 'Duplicate transaction.' });
        }
        // Verify signature
        if (!verify(tx.hash, tx.signature, tx.from)) {
            return Promise.resolve({ success: false, message: 'Invalid signature.' });
        }
        
        const fromAccount = accounts.get(tx.from);
        const pendingSentAmount = mempool
            .filter(t => t.from === tx.from && (t.type === 'TRANSFER' || t.type === 'STAKE'))
            .reduce((acc, t) => acc + t.amount, 0);

        if (!fromAccount || (fromAccount.balance - pendingSentAmount) < tx.amount) {
            return Promise.resolve({ success: false, message: 'Insufficient balance.' });
        }

        mempool.unshift(tx);
        return apiDelay({ success: true, message: 'Transaction submitted to mempool.' });
    },
    
    createWallet: (): Promise<{ publicKey: string; secretKey: string; balance: number; stakes: Stake[] }> => {
        const { publicKey, secretKey } = generateKeyPair();
        const initialBalance = 1000;
        accounts.set(publicKey, { balance: initialBalance, stakes: [] });
        return apiDelay({ publicKey, secretKey, balance: initialBalance, stakes: [] });
    },

    getWalletState: (publicKey: string): Promise<{ balance: number; stakes: Stake[] } | null> => {
        const account = accounts.get(publicKey);
        if(!account) {
            return apiDelay(null);
        }
        return apiDelay(account);
    },

    claimRewards: (publicKey: string): Promise<{success: boolean, message: string}> => {
        const account = accounts.get(publicKey);
        if(!account || account.stakes.length === 0) {
            return apiDelay({success: false, message: "No rewards to claim."});
        }
        
        const totalRewards = account.stakes.reduce((acc, s) => acc + s.rewards, 0);
        if(totalRewards < 0.0001) {
            return apiDelay({success: false, message: "No rewards to claim."});
        }

        const newStakes = account.stakes.map(s => ({ ...s, rewards: 0 }));
        const newBalance = account.balance + totalRewards;
        
        accounts.set(publicKey, {balance: newBalance, stakes: newStakes});
        
        return apiDelay({success: true, message: `Successfully claimed ${totalRewards.toFixed(6)} AN.`});
    }
};