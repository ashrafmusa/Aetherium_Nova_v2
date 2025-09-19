import fs from 'fs';
import path from 'path';

const genesisConfigPath = path.resolve(process.cwd(), 'genesis.config.json');
const networkConfigPath = path.resolve(process.cwd(), 'network.config.json');

export const GENESIS_CONFIG = JSON.parse(fs.readFileSync(genesisConfigPath, 'utf-8'));

GENESIS_CONFIG.vmMemoryLimitMB = GENESIS_CONFIG.vmMemoryLimitMB ?? 128;
GENESIS_CONFIG.vmExecutionTimeoutMs = GENESIS_CONFIG.vmExecutionTimeoutMs ?? 500;
GENESIS_CONFIG.gasPriceUnit = GENESIS_CONFIG.gasPriceUnit ?? 100;
GENESIS_CONFIG.minFee = GENESIS_CONFIG.minFee ?? 0.001;
GENESIS_CONFIG.baseReward = GENESIS_CONFIG.baseReward ?? 50;
GENESIS_CONFIG.maxTransactionsPerBlock = GENESIS_CONFIG.maxTransactionsPerBlock ?? 100;
GENESIS_CONFIG.transactionPruneInterval = GENESIS_CONFIG.transactionPruneInterval ?? 60000;
GENESIS_CONFIG.transactionTTL = GENESIS_CONFIG.transactionTTL ?? 300000;
GENESIS_CONFIG.bootstrapAddress = GENESIS_CONFIG.bootstrapAddress ?? "0xe5bca44e2313297f074536a776e8732b275505b5";
GENESIS_CONFIG.bootstrapFunds = GENESIS_CONFIG.bootstrapFunds ?? 1000000000000000;
GENESIS_CONFIG.bootstrapStake = GENESIS_CONFIG.bootstrapStake ?? 5000000;
GENESIS_CONFIG.minStake = GENESIS_CONFIG.minStake ?? 1000;
GENESIS_CONFIG.delegatorSharePercentage = GENESIS_CONFIG.delegatorSharePercentage ?? 0.2;

GENESIS_CONFIG.gasCosts = {
    BASE_EXECUTION: GENESIS_CONFIG.gasCosts?.BASE_EXECUTION ?? 100,
    STORAGE_READ: GENESIS_CONFIG.gasCosts?.STORAGE_READ ?? 10,
    STORAGE_WRITE: GENESIS_CONFIG.gasCosts?.STORAGE_WRITE ?? 100,
    LOG: GENESIS_CONFIG.gasCosts?.LOG ?? 5,
    BYTECODE_BYTE: GENESIS_CONFIG.gasCosts?.BYTECODE_BYTE ?? 0.05,
    CALL_OVERHEAD: GENESIS_CONFIG.gasCosts?.CALL_OVERHEAD ?? 50,
    CREATE_ACCOUNT: GENESIS_CONFIG.gasCosts?.CREATE_ACCOUNT ?? 2000,
    INTER_CONTRACT_CALL: GENESIS_CONFIG.gasCosts?.INTER_CONTRACT_CALL ?? 500,
    TRANSFER_BY_CONTRACT: GENESIS_CONFIG.gasCosts?.TRANSFER_BY_CONTRACT ?? 200
};

GENESIS_CONFIG.unjailPeriodMs = GENESIS_CONFIG.unjailPeriodMs ?? 86400000;
GENESIS_CONFIG.maxSlashCount = GENESIS_CONFIG.maxSlashCount ?? 3;
GENESIS_CONFIG.epochLength = GENESIS_CONFIG.epochLength ?? 100;
GENESIS_CONFIG.unstakePeriodMs = GENESIS_CONFIG.unstakePeriodMs ?? 604800000;
GENESIS_CONFIG.slashPercentage = GENESIS_CONFIG.slashPercentage ?? 0.05; // ADDED: Configurable slash percentage

const baseNetworkConfig = JSON.parse(fs.readFileSync(networkConfigPath, 'utf-8'));

const seedPeers = process.env.PEERS ? process.env.PEERS.split(',') : baseNetworkConfig.seedPeers;

export const NETWORK_CONFIG = {
    ...baseNetworkConfig,
    seedPeers,
    pruneMempoolInterval: baseNetworkConfig.pruneMempoolInterval ?? 60000
};