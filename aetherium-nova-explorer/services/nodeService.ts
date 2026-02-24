
import { sha256 } from 'js-sha256';
import type { Transaction, Block, Wallet, Validator, NetworkState, WalletState } from '../types.js';
import { ec as EC } from 'elliptic';

const ec = new EC('secp256k1');
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY ?? 'a-very-secret-key';

const authHeaders: Record<string, string> = {
    'x-api-key': API_KEY,
};

/** Derive a backend-compatible address from a secp256k1 public key.
 *  Backend formula (wallet.ts): '0x' + sha256(Buffer.from(publicKey, 'hex')).slice(0, 40)
 */
function hexToBytes(hex: string): Uint8Array {
    // browser-safe conversion
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

function deriveAddress(publicKeyHex: string): string {
    // sha256 accepts a string or array; we pass binary bytes
    return '0x' + sha256(hexToBytes(publicKeyHex)).slice(0, 40);
}

export class NodeService {

    // =============================================================================
    // PUBLIC API - Methods exposed to the frontend
    // =============================================================================

    public async getNetworkState(): Promise<NetworkState> {
        try {
            const [statusRes, chainRes, mempoolRes] = await Promise.all([
                fetch(`${API_URL}/status`, { headers: authHeaders }),
                fetch(`${API_URL}/chain`, { headers: authHeaders }),
                fetch(`${API_URL}/mempool`, { headers: authHeaders })
            ]);

            if (!statusRes.ok || !chainRes.ok || !mempoolRes.ok) {
                throw new Error(`Network fetch failed: status=${statusRes.status} chain=${chainRes.status} mempool=${mempoolRes.status}`);
            }

            const status = await statusRes.json();
            const chain = await chainRes.json();
            const pool = await mempoolRes.json();

            // The backend returns { version: "2.0", chain: [...] }
            const blocks: Block[] = [...chain.chain].reverse();

            // Backend doesn't expose validator detailed list easily yet, so we mock or fetch if available.
            // For now, we'll return an empty list or minimal info.
            const validators: any[] = [];

            return {
                stats: {
                    blockHeight: status.height,
                    tps: 0, // TODO: Calculate from recent blocks
                    activeNodes: status.peers + 1, // Peers + Self
                    marketCap: 0, // Placeholder
                },
                mempool: pool.pool || [],
                blocks: blocks,
                validators: validators,
            };
        } catch (err) {
            console.error("Failed to fetch network state", err);
            throw err;
        }
    }

    public async getWalletState(publicKey: string): Promise<WalletState | null> {
        try {
            // Check if key is address-like or pubkey. 
            // In App.tsx, wallet.publicKey is used.
            // We assume backend /balance/:address works with what is passed or we assume the frontend wallet generation produces valid addresses.
            // But wait, createWallet below creates keys.
            // If backend expects '0x'+40 chars, and we pass raw pubkey (often longer), it fails.
            // I need to ensure createWallet produces compatible addresses OR we derive here.

            // Backend `createWallet` produces address.
            // See createWallet below.

            let address = publicKey;
            // If publicKey is NOT an address (does not start with 0x), we should assume it MIGHT be one if we generated it that way.

            const res = await fetch(`${API_URL}/balance/${address}`, { headers: authHeaders });
            if (!res.ok) return null;
            const data = await res.json();

            return {
                balance: data.balance,
                stakes: []
            };
        } catch (e) {
            return null;
        }
    }

    // Client-side wallet creation (keys stay in browser!)
    public createWallet(): Wallet {
        const keyPair = ec.genKeyPair();
        const publicKey = keyPair.getPublic('hex');
        const secretKey = keyPair.getPrivate('hex');

        // Derive address matching backend formula:
        // 0x + sha256(Buffer.from(publicKey, 'hex')).slice(0, 40)
        const address = deriveAddress(publicKey);

        return {
            publicKey: address, // use address as the public-facing identifier
            secretKey,
            balance: 0,
            stakes: [],
        };
    }

    public async submitTransaction(tx: Transaction): Promise<{ success: boolean; message: string }> {
        try {
            const res = await fetch(`${API_URL}/transaction`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(tx)
            });
            const data = await res.json();
            return { success: res.ok, message: data.message || data.error };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }

    public async claimRewards(publicKey: string): Promise<{ success: boolean; message: string }> {
        return { success: false, message: "Claim rewards not implemented on mainnet yet." };
    }


    // =============================================================================
    // MOCK METHODS 
    // =============================================================================

    public _getMempool() { return []; }
    public _getBlocks() { return []; }
    public _getWallets() { return new Map(); }
    public _getValidators() { return []; }
    public _stopBlockProduction() { }
}

export const nodeService = new NodeService();