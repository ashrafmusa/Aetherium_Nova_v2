import fs from 'fs';
import path from 'path';
import { getLogger } from './logger.js';
import { ContractEvent } from './SmartContract.js';



const log = getLogger();

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
export function getContractStorage(address: string): Map<string, any> {
  return new Map(contractStorage.get(address) ?? []);
}
export function getContractEvents(txId: string): ContractEvent[] { return contractEvents.get(txId) ?? []; }
export function getUnbondingDelegations(): Array<{ id: string; delegatorAddress: string; validatorAddress: string; amount: number; releaseTime: number }> {
  return Array.from(unbondingDelegations.values());
}

export function setBalance(address: string, amount: number): void { balances.set(address, amount); }
export function setNonce(address: string, nonce: number): void { nonces.set(address, nonce); }
export function setContractCode(address: string, code: string): void { contractCode.set(address, code); }
export function setContractStorage(address: string, storage: Map<string, any>): void { contractStorage.set(address, storage); }
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
  log.info('[Ledger] In-memory ledger cleared.');
}


import { db } from './services/database.js';

export async function saveLedgerToDisk(): Promise<void> {
  try {
    const batchOps = [
      { type: 'put', key: 'ledger:balances', value: Array.from(balances.entries()) },
      { type: 'put', key: 'ledger:nonces', value: Array.from(nonces.entries()) },
      { type: 'put', key: 'ledger:contractCode', value: Array.from(contractCode.entries()) },
      { type: 'put', key: 'ledger:contractStorage', value: Array.from(contractStorage.entries()).map(([k, v]) => [k, Array.from(v.entries())]) },
      { type: 'put', key: 'ledger:contractEvents', value: Array.from(contractEvents.entries()) },
      { type: 'put', key: 'ledger:unbondingDelegations', value: Array.from(unbondingDelegations.entries()) }
    ];

    // writing the batch to LevelDB
    await db.batch(batchOps as any);
    log.info(`[Ledger] State snapshot saved to LevelDB.`);
  } catch (err: any) {
    log.error(`[Ledger] Failed to save state to DB`, { err });
  }
}

export async function loadLedgerFromDisk(): Promise<boolean> {
  try {
    const rawBalances = await db.get('ledger:balances');
    if (!rawBalances) {
      log.info('[Ledger] No previous state found in DB.');
      return false;
    }

    balances.clear();
    nonces.clear();
    contractCode.clear();
    contractStorage.clear();
    contractEvents.clear();
    unbondingDelegations.clear();

    balances = new Map(rawBalances);
    nonces = new Map(await db.get('ledger:nonces') || []);
    contractCode = new Map(await db.get('ledger:contractCode') || []);

    const rawContractStorage = await db.get('ledger:contractStorage') || [];
    contractStorage = new Map(rawContractStorage.map(([k, v]: [string, any]) => [k, new Map(v)]));

    contractEvents = new Map(await db.get('ledger:contractEvents') || []);
    unbondingDelegations = new Map(await db.get('ledger:unbondingDelegations') || []);

    log.info('[Ledger] State snapshot loaded from LevelDB.');
    return true;
  } catch (err: any) {
    if (err.code === 'LEVEL_NOT_FOUND') return false;
    log.error(`[Ledger] Failed to load state from disk: ${err.message || String(err)}`);
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