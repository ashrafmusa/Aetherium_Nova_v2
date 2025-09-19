import fs from 'fs';
import path from 'path';
import logger from './logger.js';
const LEDGER_FILE = path.resolve("ledger.snapshot.json");
let balances = new Map();
let nonces = new Map();
let contractCode = new Map();
let contractStorage = new Map();
let contractEvents = new Map();
let unbondingDelegations = new Map();
export function getBalance(address) { return balances.get(address) ?? 0; }
export function getAllBalances() { return new Map(balances); }
export function getNonceForAddress(address) { return nonces.get(address) ?? 0; }
export function getContractCode(address) { return contractCode.get(address); }
export function getContractStorage(address) {
    return new Map(contractStorage.get(address) ?? []);
}
export function getContractEvents(txId) { return contractEvents.get(txId) ?? []; }
export function getUnbondingDelegations() {
    return Array.from(unbondingDelegations.values());
}
export function setBalance(address, amount) { balances.set(address, amount); }
export function setNonce(address, nonce) { nonces.set(address, nonce); }
export function setContractCode(address, code) { contractCode.set(address, code); }
export function setContractStorage(address, storage) { contractStorage.set(address, storage); }
export function setContractEvents(txId, events) { contractEvents.set(txId, events); }
export function setUnbondingDelegations(unbonding) {
    unbondingDelegations.set(unbonding.id, unbonding);
}
export function deleteUnbondingDelegation(id) {
    unbondingDelegations.delete(id);
}
export function clearLedger() {
    balances.clear();
    nonces.clear();
    contractCode.clear();
    contractStorage.clear();
    contractEvents.clear();
    unbondingDelegations.clear();
    logger.info('[Ledger] In-memory ledger cleared.');
}
export function saveLedgerToDisk() {
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
    }
    catch (err) {
        logger.error(`[Ledger] Failed to save state to disk: ${err.message || String(err)}`);
    }
}
export function loadLedgerFromDisk() {
    if (!fs.existsSync(LEDGER_FILE))
        return false;
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
        contractStorage = new Map(state.contractStorage.map(([k, v]) => [k, new Map(v)]));
        contractEvents = new Map(state.contractEvents);
        unbondingDelegations = new Map(state.unbondingDelegations);
        logger.info('[Ledger] State snapshot loaded from disk.');
        return true;
    }
    catch (err) {
        logger.error(`[Ledger] Failed to load state from disk: ${err.message || String(err)}`);
        return false;
    }
}
export function _getBalancesMap() { return balances; }
export function _getNoncesMap() { return nonces; }
export function _getContractCodeMap() { return contractCode; }
export function _getContractStorageMap() { return contractStorage; }
export function _getContractEventsMap() { return contractEvents; }
export function _getUnbondingDelegationsMap() { return unbondingDelegations; }
export function _setBalancesMap(map) { balances = map; }
export function _setNoncesMap(map) { nonces = map; }
export function _setContractCodeMap(map) { contractCode = map; }
export function _setContractStorageMap(map) { contractStorage = map; }
export function _setContractEventsMap(map) { contractEvents = map; }
export function _setUnbondingDelegationsMap(map) { unbondingDelegations = map; }
