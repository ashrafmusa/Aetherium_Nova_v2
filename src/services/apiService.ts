// src/services/apiService.ts (Updated)
import axios from "axios";
import { NETWORK_CONFIG } from '../config.js';
import { type Transaction } from "../Transaction.js";
import { createTransaction } from "../utils/txUtils.js";
import { logApiError } from "../utils/cliUtils.js";
import { Block } from "../chain.js";

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

export async function fetchNonce(address: string): Promise<number | null> {
  try {
    const res = await api.get(`/nonce/${address}`);
    return res.data.nonce;
  } catch (error) {
    logApiError("Error fetching nonce", error);
    return null;
  }
}

export async function sendTransaction(tx: Transaction): Promise<{ txId: string; contractAddress?: string } | null> {
  try {
    const res = await api.post('/transaction', tx);
    return res.data;
  } catch (error) {
    logApiError("Error sending transaction", error);
    return null;
  }
}

export async function proposeBlockAPI(block: Block): Promise<any | null> {
  try {
    const res = await api.post('/proposeBlock', block);
    return res.data;
  } catch (error) {
    logApiError("Error proposing block", error);
    return null;
  }
}

export async function getBalance(address: string): Promise<number | null> {
  try {
    const res = await api.get(`/balance/${address}`);
    return res.data.balance;
  } catch (error) {
    logApiError("Error fetching balance", error);
    return null;
  }
}

export async function getBlock(index: number): Promise<any | null> {
  try {
    const res = await api.get(`/blocks/${index}`);
    return res.data;
  } catch (error) {
    logApiError("Error fetching block", error);
    return null;
  }
}

export async function getContractState(address: string): Promise<{ address: string; storage: { [key: string]: any } } | null> {
  try {
    const res = await api.get(`/contract/${address}`);
    return res.data;
  } catch (error) {
    logApiError("Error fetching contract state", error);
    return null;
  }
}

export async function getStatus(): Promise<any | null> {
  try {
    const res = await api.get('/status');
    return res.data;
  } catch (error) {
    logApiError("Error fetching status", error);
    return null;
  }
}

export async function callReadOnlyContractMethod(contractAddress: string, method: string, params: any[]): Promise<any | null> {
  try {
    const res = await api.get(`/contract/${contractAddress}/call/${method}`, {
      params: {
        args: JSON.stringify(params)
      }
    });
    return res.data;
  } catch (error) {
    logApiError("Error calling read-only contract method", error);
    return null;
  }
}

export async function unjailValidatorAPI(address: string): Promise<{ success: boolean; error?: string } | null> {
  try {
    const res = await api.post('/unjail', { address });
    return res.data;
  } catch (error: any) {
    logApiError("Error unjailing validator", error);
    return null;
  }
}

export async function getLatestBlock(): Promise<any | null> {
  try {
    const res = await api.get('/latestBlock');
    return res.data;
  } catch (error) {
    logApiError("Error fetching latest block", error);
    return null;
  }
}

export async function getMempoolTransactions(): Promise<any[] | null> {
  try {
    const res = await api.get('/mempool');
    return res.data.pool;
  } catch (error) {
    logApiError("Error fetching mempool transactions", error);
    return null;
  }
}