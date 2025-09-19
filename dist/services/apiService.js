// src/services/apiService.ts (Final Corrected Version)
import axios from "axios";
import { NETWORK_CONFIG } from '../config.js';
import { createTransaction } from "../utils/txUtils.js";
import { logApiError } from "../utils/cliUtils.js";
const API_BASE_URL = `http://localhost:${process.env.PORT || NETWORK_CONFIG.defaultPort}`;
const API_KEY = process.env.API_KEY || "";
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});
export { createTransaction };
export async function fetchNonce(address) {
    try {
        const res = await api.get(`/nonce/${address}`);
        return res.data.nonce;
    }
    catch (error) {
        logApiError("Error fetching nonce", error); // Re-added proper error logging
        return null;
    }
}
export async function sendTransaction(tx) {
    try {
        const res = await api.post('/transaction', tx);
        return res.data;
    }
    catch (error) {
        logApiError("Error sending transaction", error);
        return null;
    }
}
export async function mineBlock(proposerAddress, proposerPrivateKey, passphrase) {
    try {
        const res = await api.post('/mine', {
            proposerAddress,
            proposerPrivateKey,
        }, {
            headers: {
                'x-passphrase': passphrase
            }
        });
        return res.data;
    }
    catch (error) {
        logApiError("Error mining block", error);
        return null;
    }
}
export async function getBalance(address) {
    try {
        const res = await api.get(`/balance/${address}`);
        return res.data.balance;
    }
    catch (error) {
        logApiError("Error fetching balance", error);
        return null;
    }
}
export async function getBlock(index) {
    try {
        const res = await api.get(`/blocks/${index}`);
        return res.data;
    }
    catch (error) {
        logApiError("Error fetching block", error);
        return null;
    }
}
export async function getContractState(address) {
    try {
        const res = await api.get(`/contract/${address}`);
        return res.data;
    }
    catch (error) {
        logApiError("Error fetching contract state", error);
        return null;
    }
}
export async function getStatus() {
    try {
        const res = await api.get('/status');
        return res.data;
    }
    catch (error) {
        logApiError("Error fetching status", error);
        return null;
    }
}
export async function callReadOnlyContractMethod(contractAddress, method, params) {
    try {
        const res = await api.get(`/contract/${contractAddress}/call/${method}`, {
            params: {
                args: JSON.stringify(params)
            }
        });
        return res.data;
    }
    catch (error) {
        logApiError("Error calling read-only contract method", error);
        return null;
    }
}
export async function unjailValidatorAPI(address) {
    try {
        const res = await api.post('/unjail', { address });
        return res.data;
    }
    catch (error) {
        logApiError("Error unjailing validator", error);
        return null;
    }
}
export async function getLatestBlock() {
    try {
        const res = await api.get('/latestBlock');
        return res.data;
    }
    catch (error) {
        logApiError("Error fetching latest block", error);
        return null;
    }
}
export async function getMempoolTransactions() {
    try {
        const res = await api.get('/mempool');
        return res.data.pool;
    }
    catch (error) {
        logApiError("Error fetching mempool transactions", error);
        return null;
    }
}
