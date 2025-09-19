import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { ContractEvent } from './SmartContract.js';

const LEDGER_FILE = path.resolve("ledger.snapshot.json");

let balances = new Map<string, number>();
let nonces = new Map<string, number>();
let contractCode = new Map<string, string>();
let contractStorage = new Map<string, Map<string, any>>();
let contractEvents = new Map<string, ContractEvent[]>();
let unbondingDelegations = new Map<string, { id: string; delegatorAddress: string; validatorAddress: string; amount: number; releaseTime: number }>();

export function getBalance(address: string): number { return balances.get(address) ?? 0; }
export function getAllBalances(): Map<string, number> { return new Map(balances); }
export function getNonceForAddress(address: string): number { return nonces.get(address) ?? 0; }
export function getContractCode(address: string): string | undefined { return contractCode.get(address); }
export function getContractStorage(address:string): Map<string, any> {
    return new Map(contractStorage.get(address) ?? []);
}
export function getContractEvents(txId: string): ContractEvent[] { return contractEvents.get(txId) ?? []; }
export function getUnbondingDelegations(): Array<{ id: string; delegatorAddress: string; validatorAddress: string; amount: number; releaseTime: number }> {
    return Array.from(unbondingDelegations.values());
}

export function setBalance(address: string, amount: number): void { balances.set(address, amount); }
export function setNonce(address: string, nonce: number): void { nonces.set(address, nonce); }
export function setContractCode(address: string, code: string): void { contractCode.set(address, code); }
export function setContractStorage(address: string, storage: Map<string, any>): void { contractStorage.set(address, storage);}
export function setContractEvents(txId: string, events: ContractEvent[]): void { contractEvents.set(txId, events); }
export function setUnbondingDelegations(unbonding: { id: string; delegatorAddress: string; validatorAddress: string; amount: number; releaseTime: number }): void {
    unbondingDelegations.set(unbonding.id, unbonding);
}
export function deleteUnbondingDelegation(id: string): void {
    unbondingDelegations.delete(id);
}

export function clearLedger(): void {
  balances.clear();
  nonces.clear();
  contractCode.clear();
  contractStorage.clear();
  contractEvents.clear();
  unbondingDelegations.clear();
  logger.info('[Ledger] In-memory ledger cleared.');
}

export function saveLedgerToDisk(): void {
  try {
    const state = {
      balances: Array.from(balances.entries()),
      nonces: Array.from(nonces.entries()),
      contractCode: Array.from(contractCode.entries()),
      contractStorage: Array.from(contractStorage.entries()).map(([k, v]) => [k, Array.from(v.entries())]),
      contractEvents: Array.from(contractEvents.entries()),
      unbondingDelegations: Array.from(unbondingDelegations.entries())
    };
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(state, null, 2));
    logger.info('[Ledger] State snapshot saved to disk.');
  } catch (err: any) {
    logger.error(`[Ledger] Failed to save state to disk: ${err.message || String(err)}`);
  }
}

export function loadLedgerFromDisk(): boolean {
  if (!fs.existsSync(LEDGER_FILE)) return false;
  try {
    const raw = fs.readFileSync(LEDGER_FILE, 'utf-8');
    const state = JSON.parse(raw);
    
    balances.clear();
    nonces.clear();
    contractCode.clear();
    contractStorage.clear();
    contractEvents.clear();
    unbondingDelegations.clear();

    balances = new Map(state.balances);
    nonces = new Map(state.nonces);
    contractCode = new Map(state.contractCode);
    contractStorage = new Map(state.contractStorage.map(([k, v]: [string, any]) => [k, new Map(v)]));
    contractEvents = new Map(state.contractEvents);
    unbondingDelegations = new Map(state.unbondingDelegations);

    logger.info('[Ledger] State snapshot loaded from disk.');
    return true;
  } catch(err: any) {
    logger.error(`[Ledger] Failed to load state from disk: ${err.message || String(err)}`);
    return false;
  }
}

export function _getBalancesMap(): Map<string, number> { return balances; }
export function _getNoncesMap(): Map<string, number> { return nonces; }
export function _getContractCodeMap(): Map<string, string> { return contractCode; }
export function _getContractStorageMap(): Map<string, Map<string, any>> { return contractStorage; }
export function _getContractEventsMap(): Map<string, ContractEvent[]> { return contractEvents; }
export function _getUnbondingDelegationsMap(): Map<string, { id: string; delegatorAddress: string; validatorAddress: string; amount: number; releaseTime: number }> { return unbondingDelegations; }

export function _setBalancesMap(map: Map<string, number>): void { balances = map; }
export function _setNoncesMap(map: Map<string, number>): void { nonces = map; }
export function _setContractCodeMap(map: Map<string, string>): void { contractCode = map; }
export function _setContractStorageMap(map: Map<string, Map<string, any>>): void { contractStorage = map; }
export function _setContractEventsMap(map: Map<string, ContractEvent[]>): void { contractEvents = map; }
export function _setUnbondingDelegationsMap(map: Map<string, { id: string; delegatorAddress: string; validatorAddress: string; amount: number; releaseTime: number }>): void { unbondingDelegations = map; }