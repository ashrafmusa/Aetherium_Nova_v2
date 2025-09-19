// src/staking.ts (Corrected)
import logger from "./logger.js";
import fs from 'fs';
import path from 'path';
import { setBalance, getBalance } from "./ledger.js";
import { GENESIS_CONFIG } from './config.js';
const STAKING_LEDGER_FILE = path.resolve("staking.ledger.json");
let validators = new Map();
export function getValidator(address) {
    return validators.get(address);
}
export function getAllValidators() {
    return new Map(validators);
}
export function addOrUpdateValidator(validator) {
    validators.set(validator.address, validator);
}
export function clearStakingLedger() {
    validators.clear();
    logger.info('[Staking] In-memory staking ledger cleared.');
}
export function saveStakingLedgerToDisk() {
    try {
        const state = {
            validators: Array.from(validators.entries()).map(([k, v]) => {
                const validatorCopy = { ...v, delegators: Array.from(v.delegators.entries()) };
                return [k, validatorCopy];
            })
        };
        fs.writeFileSync(STAKING_LEDGER_FILE, JSON.stringify(state, null, 2));
        logger.info('[Staking] Staking ledger snapshot saved to disk.');
    }
    catch (err) {
        logger.error(`[Staking] Failed to save staking ledger to disk: ${err.message || String(err)}`);
    }
}
export function loadStakingLedgerFromDisk() {
    if (!fs.existsSync(STAKING_LEDGER_FILE))
        return false;
    try {
        const raw = fs.readFileSync(STAKING_LEDGER_FILE, 'utf-8');
        const state = JSON.parse(raw);
        validators.clear();
        state.validators.forEach(([key, value]) => {
            validators.set(key, { ...value, delegators: new Map(value.delegators) });
        });
        logger.info('[Staking] Staking ledger snapshot loaded from disk.');
        return true;
    }
    catch (err) {
        logger.error(`[Staking] Failed to load state from disk: ${err.message || String(err)}`);
        return false;
    }
}
export function slashValidator(address, percentage) {
    const validator = validators.get(address);
    if (validator) {
        const slashedAmount = validator.totalStake * percentage;
        validator.totalStake -= slashedAmount;
        setBalance(address, getBalance(address) + slashedAmount);
        validator.slashCount = (validator.slashCount ?? 0) + 1;
        if (validator.slashCount && validator.slashCount >= (GENESIS_CONFIG.maxSlashCount ?? 3)) {
            validator.jailed = true;
            validator.jailedSince = Date.now();
            logger.warn(`[Staking] Validator ${address.slice(0, 10)}... has been jailed for exceeding max slash count.`);
        }
        logger.warn(`[Staking] Validator ${address.slice(0, 10)}... slashed by ${percentage * 100}%. New stake: ${validator.totalStake}`);
        addOrUpdateValidator(validator);
    }
}
export function distributeRewards(proposerAddress, amount) {
    const validator = getValidator(proposerAddress);
    if (!validator) {
        logger.warn(`[Staking] Cannot distribute rewards: Validator ${proposerAddress.slice(0, 10)}... not found.`);
        return;
    }
    const delegatorShare = amount * (GENESIS_CONFIG.delegatorSharePercentage ?? 0.2);
    const validatorShare = amount - delegatorShare;
    setBalance(proposerAddress, getBalance(proposerAddress) + validatorShare);
    logger.info(`[Staking] Validator ${proposerAddress.slice(0, 10)}... received ${validatorShare.toFixed(4)} AN reward.`);
    let totalDelegatedStake = 0;
    validator.delegators.forEach(d => {
        totalDelegatedStake += d.amount;
    });
    if (totalDelegatedStake > 0) {
        validator.delegators.forEach(d => {
            const reward = (d.amount / totalDelegatedStake) * delegatorShare;
            d.rewards += reward;
            logger.info(`[Staking] Delegator ${d.address.slice(0, 10)}... accrued ${reward.toFixed(4)} AN reward.`);
        });
    }
    addOrUpdateValidator(validator);
    saveStakingLedgerToDisk();
}
export function chooseNextBlockProposer(lastBlockHash) {
    const activeValidators = getActiveValidators();
    if (activeValidators.length === 0) {
        logger.warn('[Staking] No active validators found to propose a block.');
        return undefined;
    }
    const blockHashBuffer = Buffer.from(lastBlockHash, 'hex');
    const hashAsNumber = blockHashBuffer.readUInt32BE(0);
    const seed = Number(hashAsNumber);
    const randomIndex = seed % activeValidators.length;
    return activeValidators[randomIndex].address;
}
export function updateEpochValidatorSet(currentBlockIndex, currentBlockHash) {
    if (currentBlockIndex === 0) {
        const bootstrapValidator = getValidator(GENESIS_CONFIG.bootstrapAddress);
        if (bootstrapValidator) {
            bootstrapValidator.publicKey = '0'.repeat(64);
            addOrUpdateValidator(bootstrapValidator);
        }
        else {
            const genesisValidator = {
                address: GENESIS_CONFIG.bootstrapAddress,
                totalStake: GENESIS_CONFIG.bootstrapStake,
                delegators: new Map(),
                jailed: false,
                slashCount: 0,
                publicKey: '0'.repeat(64)
            };
            addOrUpdateValidator(genesisValidator);
        }
    }
}
export function unjailValidator(address) {
    const validator = validators.get(address);
    if (!validator) {
        logger.warn(`[Staking] Cannot unjail: Validator ${address} not found.`);
        return false;
    }
    if (!validator.jailed) {
        logger.info(`[Staking] Validator ${address.slice(0, 10)}... is not currently jailed.`);
        return false;
    }
    if (validator.jailedSince && (Date.now() - validator.jailedSince < GENESIS_CONFIG.unjailPeriodMs)) {
        logger.warn(`[Staking] Validator ${address.slice(0, 10)}... cannot be unjailed yet. Unjail period not over.`);
        return false;
    }
    if (validator.slashCount && validator.slashCount >= (GENESIS_CONFIG.maxSlashCount ?? 3)) {
        logger.error(`[Staking] Validator ${address.slice(0, 10)}... has exceeded max slash count (${GENESIS_CONFIG.maxSlashCount}) and cannot be unjailed.`);
        return false;
    }
    validator.jailed = false;
    validator.jailedSince = undefined;
    addOrUpdateValidator(validator);
    saveStakingLedgerToDisk();
    logger.info(`[Staking] Validator ${address.slice(0, 10)}... unjailed successfully.`);
    return true;
}
export function getActiveValidators() {
    return Array.from(validators.values())
        .filter(v => !v.jailed && v.totalStake > 0)
        .sort((a, b) => b.totalStake - a.totalStake);
}
export function _getValidatorsMap() { return validators; }
export function _setValidatorsMap(map) { validators = map; }
