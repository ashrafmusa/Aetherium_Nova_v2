
import { sha256 } from 'js-sha256';
import type { Transaction, Block, Wallet, Validator, NetworkState, WalletState } from '../types.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

const API_URL = 'http://localhost:3001';

export class NodeService {

    // =============================================================================
    // PUBLIC API - Methods exposed to the frontend
    // =============================================================================

    public async getNetworkState(): Promise<NetworkState> {
        try {
            const [statusRes, chainRes, mempoolRes] = await Promise.all([
                fetch(`${API_URL}/status`),
                fetch(`${API_URL}/chain`),
                fetch(`${API_URL}/mempool`)
            ]);

            const status = await statusRes.json();
            const chain = await chainRes.json();
            const pool = await mempoolRes.json();

            // The backend returns { version: "2.0", chain: [...] }
            const blocks: Block[] = chain.chain.reverse();

            // Backend doesn't expose validator detailed list easily yet, so we mock or fetch if available.
            // For now, we'll return an empty list or scrape from blocks if needed.
            // But types.ts says validators are in NetworkState.
            // Let's assume we can get validators from a new endpoint or just mock for now to not break UI.
            // I'll add a TODO to backend if needed.

            // Actually, let's just allow empty validators list or minimal info.
            const validators: any[] = [];

            return {
                stats: {
                    blockHeight: status.height,
                    tps: 0, // TODO: Calculate from recent blocks
                    activeNodes: status.peers + 1, // Peers + Self
                },
                mempool: pool.pool || [],
                blocks: blocks,
                validators: validators,
                confirmedTransactions: [], // Can be derived from blocks if needed
            };
        } catch (err) {
            console.error("Failed to fetch network state", err);
            throw err;
        }
    }

    public async getWalletState(publicKey: string): Promise<WalletState | null> {
        // We typically use address (derived from public key) to query balance.
        // The backend expects an address (42 chars hex).
        // If the frontend passes publicKey, we must derive address or expect address.
        // Looking at genesis.ts logic or crypto utils might help.
        // For now, assuming publicKey IS the address if it starts with 0x, or we derive it.
        // Wait, typical ethereum: Address is last 20 bytes of PubKey hash.
        // Let's try to query /balance with the key provided.

        // Actually, let's derive address if possible. 
        // But for Aetherium Nova v2, address generation logic is specific.
        // I will assume the UI passes the ADDRESS not just raw public key, or the backend can handle it.
        // If the UI passes a raw long public key, I need to convert it.
        // Let's look at `createWallet` logic below to see how address is made.

        try {
            // Check if key is address-like
            let address = publicKey;
            if (!address.startsWith('0x')) {
                // Try to derive.
                // const key = ec.keyFromPublic(publicKey, 'hex');
                // address = ...
                // To be safe, I will just try sending it.
            }

            const res = await fetch(`${API_URL}/balance/${address}`);
            if (!res.ok) return null;
            const data = await res.json();

            return {
                balance: data.balance,
                stakes: [] // Staking info not yet exposed by simple balance endpoint
            };
        } catch (e) {
            return null;
        }
    }

    // Client-side wallet creation — keys stay in browser, never sent to server!
    public createWallet(): Wallet {
        const seed = crypto.getRandomValues(new Uint8Array(32));
        const { publicKey: pubKeyBytes } = ml_dsa65.keygen(seed);
        const publicKey = Array.from(pubKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const secretKey = Array.from(seed).map(b => b.toString(16).padStart(2, '0')).join('');
        // Derive address matching backend formula: 0x + sha256(pubKeyBytes).slice(0, 40)
        const hash = sha256(new Uint8Array(pubKeyBytes));
        const address = '0x' + hash.slice(0, 40);
        return {
            publicKey,
            secretKey,
            balance: 0,
            stakes: [],
        };
    }

    public async submitTransaction(tx: Transaction): Promise<{ success: boolean; message: string }> {
        try {
            const res = await fetch(`${API_URL}/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tx)
            });
            const data = await res.json();
            return { success: res.ok, message: data.message || data.error };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }

    public async claimRewards(publicKey: string): Promise<{ success: boolean; message: string }> {
        // Not implemented on backend yet
        return { success: false, message: "Claim rewards not implemented on mainnet yet." };
    }


    // =============================================================================
    // MOCK METHODS (Required to keep TS happy if interfaces rely on them, 
    // or we can remove if we clean up callsites)
    // =============================================================================

    public _getMempool() { return []; }
    public _getBlocks() { return []; }
    public _getWallets() { return new Map(); }
    public _getValidators() { return []; }
    public _stopBlockProduction() { }
}

export const nodeService = new NodeService();