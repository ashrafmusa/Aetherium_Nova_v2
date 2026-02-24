import fs from 'fs';
import path from 'path';

export interface GasCosts {
    BASE_EXECUTION: number;
    STORAGE_READ: number;
    STORAGE_WRITE: number;
    LOG: number;
    BYTECODE_BYTE: number;
    CALL_OVERHEAD: number;
    CREATE_ACCOUNT: number;
    INTER_CONTRACT_CALL: number;
    TRANSFER_BY_CONTRACT: number;
}

export interface GenesisConfig {
    chainId: number;
    vmMemoryLimitMB: number;
    vmExecutionTimeoutMs: number;
    gasPriceUnit: number;
    minFee: number;
    baseReward: number;
    maxTransactionsPerBlock: number;
    transactionPruneInterval: number;
    transactionTTL: number;
    bootstrapAddress: string;
    bootstrapFunds: number;
    bootstrapStake: number;
    minStake: number;
    delegatorSharePercentage: number;
    gasCosts: GasCosts;
    unjailPeriodMs: number;
    maxSlashCount: number;
    epochLength: number;
    unstakePeriodMs: number;
    slashPercentage: number;
    totalSupply: number;
    genesisBlockTimestamp: number;
    maxMempoolSize: number;
}

export interface NetworkConfig {
    defaultPort: number;
    seedPeers: string[];
    pruneMempoolInterval: number;
    [key: string]: unknown;
}

let genesisConfig: GenesisConfig | null = null;
let networkConfig: NetworkConfig | null = null;

function loadGenesisConfig(): GenesisConfig {
    if (genesisConfig) return genesisConfig;

    const genesisConfigPath = path.resolve(process.cwd(), 'genesis.config.json');
    let rawConfig: Partial<GenesisConfig>;
    try {
        rawConfig = JSON.parse(fs.readFileSync(genesisConfigPath, 'utf-8'));
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Config] FATAL: Failed to load genesis.config.json: ${msg}`);
        process.exit(1);
    }

    const config: GenesisConfig = {
        chainId: rawConfig.chainId ?? 2,
        vmMemoryLimitMB: rawConfig.vmMemoryLimitMB ?? 128,
        vmExecutionTimeoutMs: rawConfig.vmExecutionTimeoutMs ?? 500,
        gasPriceUnit: rawConfig.gasPriceUnit ?? 100,
        minFee: rawConfig.minFee ?? 0.001,
        baseReward: rawConfig.baseReward ?? 50,
        maxTransactionsPerBlock: rawConfig.maxTransactionsPerBlock ?? 100,
        transactionPruneInterval: rawConfig.transactionPruneInterval ?? 60000,
        transactionTTL: rawConfig.transactionTTL ?? 300000,
        bootstrapAddress: rawConfig.bootstrapAddress ?? "0xe5bca44e2313297f074536a776e8732b275505b5",
        bootstrapFunds: rawConfig.bootstrapFunds ?? 1000000000000000,
        bootstrapStake: rawConfig.bootstrapStake ?? 5000000,
        minStake: rawConfig.minStake ?? 1000,
        delegatorSharePercentage: rawConfig.delegatorSharePercentage ?? 0.2,
        gasCosts: {
            BASE_EXECUTION: rawConfig.gasCosts?.BASE_EXECUTION ?? 100,
            STORAGE_READ: rawConfig.gasCosts?.STORAGE_READ ?? 10,
            STORAGE_WRITE: rawConfig.gasCosts?.STORAGE_WRITE ?? 100,
            LOG: rawConfig.gasCosts?.LOG ?? 5,
            BYTECODE_BYTE: rawConfig.gasCosts?.BYTECODE_BYTE ?? 0.05,
            CALL_OVERHEAD: rawConfig.gasCosts?.CALL_OVERHEAD ?? 50,
            CREATE_ACCOUNT: rawConfig.gasCosts?.CREATE_ACCOUNT ?? 2000,
            INTER_CONTRACT_CALL: rawConfig.gasCosts?.INTER_CONTRACT_CALL ?? 500,
            TRANSFER_BY_CONTRACT: rawConfig.gasCosts?.TRANSFER_BY_CONTRACT ?? 200
        },
        unjailPeriodMs: rawConfig.unjailPeriodMs ?? 86400000,
        maxSlashCount: rawConfig.maxSlashCount ?? 3,
        epochLength: rawConfig.epochLength ?? 100,
        unstakePeriodMs: rawConfig.unstakePeriodMs ?? 604800000,
        slashPercentage: rawConfig.slashPercentage ?? 0.05,
        totalSupply: rawConfig.totalSupply ?? 1000000000,
        genesisBlockTimestamp: rawConfig.genesisBlockTimestamp ?? 1700000000000,
        maxMempoolSize: rawConfig.maxMempoolSize ?? 5000,
    };

    genesisConfig = config;
    return genesisConfig;
}

function loadNetworkConfig(): NetworkConfig {
    if (networkConfig) return networkConfig;

    const networkConfigPath = path.resolve(process.cwd(), 'network.config.json');
    let baseNetworkConfig: Partial<NetworkConfig>;
    try {
        baseNetworkConfig = JSON.parse(fs.readFileSync(networkConfigPath, 'utf-8'));
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Config] FATAL: Failed to load network.config.json: ${msg}`);
        process.exit(1);
    }
    const seedPeers = process.env.PEERS ? process.env.PEERS.split(',') : (baseNetworkConfig.seedPeers ?? []);

    networkConfig = {
        ...baseNetworkConfig,
        seedPeers,
        pruneMempoolInterval: baseNetworkConfig.pruneMempoolInterval ?? 60000
    } as NetworkConfig;
    return networkConfig;
}

export const GENESIS_CONFIG = loadGenesisConfig();
export const NETWORK_CONFIG = loadNetworkConfig();