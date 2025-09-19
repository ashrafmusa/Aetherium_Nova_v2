// src/chain.ts (Final Corrected Version)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { type Transaction, getTransactionId, TxType, createRewardTransaction } from './Transaction.js';
import { clearLedger, processBlockTransactions, rebuildLedgerFromChain } from './ledger_processor.js';
import { saveLedgerToDisk, loadLedgerFromDisk, setBalance, _getBalancesMap, _getNoncesMap, _getContractCodeMap, _getContractStorageMap, _setBalancesMap, _setNoncesMap, _setContractCodeMap, _setContractStorageMap } from './ledger.js';
import mempool from './pool.js';
import logger from './logger.js';
import { GENESIS_CONFIG } from './config.js';
import { addOrUpdateValidator, saveStakingLedgerToDisk, loadStakingLedgerFromDisk, type Validator, chooseNextBlockProposer, getValidator, _getValidatorsMap, _setValidatorsMap, updateEpochValidatorSet } from './staking.js';
import { verifySignature } from './wallet.js';

const CHAIN_FILE = path.resolve("chain.v2.json");

export interface Block {
  index: number;
  previousHash: string;
  timestamp: number;
  data: Transaction[];
  hash: string;
  proposer: string;
  proposerPublicKey: string;
  signature: string;
  shardId?: number;
}

let chain: Block[] = [];

export function calculateBlockHash(block: Omit<Block, 'hash' | 'signature'>): string {
  const { index, previousHash, timestamp, data, proposer, proposerPublicKey, shardId } = block;
  const txString = JSON.stringify(
    [...data].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return getTransactionId(a).localeCompare(getTransactionId(b));
    })
  );
  const raw = `${index}${previousHash}${timestamp}${proposer}${proposerPublicKey}${txString}${shardId ?? 0}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function saveChain(): void {
  try {
    const data = { version: "2.0", chain };
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(data, null, 2));
    logger.info('[Chain] Chain saved to disk.');
  } catch (err: any) {
    logger.error(`[Chain] Failed to save chain to disk: ${err.message || String(err)}`);
  }
}

function createGenesisBlock(): Block {
  const index = 0;
  const timestamp = GENESIS_CONFIG.genesisBlockTimestamp;
  const previousHash = "0".repeat(64);
  const data: Transaction[] = [];
  const proposer = GENESIS_CONFIG.bootstrapAddress;
  const proposerPublicKey = "-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEq9cO+6/i+k9hT4gC/dK9c/FfE+15/qJd\npR1c0yQ3/w4fJ+V1F/u0fK3rC3f+16u7/z48/c/q/q/q/q/q/q/q/q/q/q/q/q/q\n-----END PUBLIC KEY-----\n";
  const signature = "0".repeat(128);
  const shardId = 0;
  const hash = calculateBlockHash({ index, previousHash, timestamp, data, proposer, proposerPublicKey, shardId });
  return { index, previousHash, timestamp, data, proposer, proposerPublicKey, hash, signature, shardId };
}

(async () => {
  try {
    const exists = await fs.promises.access(CHAIN_FILE).then(() => true).catch(() => false);
    if (exists) {
      const fileContent = await fs.promises.readFile(CHAIN_FILE, 'utf-8');
      const file = JSON.parse(fileContent);

      if (file.version !== "2.0" || !Array.isArray(file.chain)) {
        throw new Error("Invalid or incompatible chain file version/structure.");
      }
      chain = file.chain;

      const ledgerLoaded = loadLedgerFromDisk();
      const stakingLedgerLoaded = loadStakingLedgerFromDisk();

      if (!ledgerLoaded || !stakingLedgerLoaded) {
        logger.warn('[Chain] Ledger or Staking Ledger snapshot not found or corrupted, rebuilding from chain...');
        const rebuildSuccess = await rebuildLedgerFromChain(chain);
        if (!rebuildSuccess) {
          throw new Error("Failed to rebuild ledgers from chain during startup.");
        }
        saveLedgerToDisk();
        saveStakingLedgerToDisk();
      }
      logger.info(`[Chain] Loaded ${chain.length} blocks from disk.`);
    } else {
      logger.info("[Chain] No chain file found. Creating genesis state.");
      chain = [createGenesisBlock()];
      clearLedger();
      await rebuildLedgerFromChain(chain);
      saveChain();
      saveLedgerToDisk();
      saveStakingLedgerToDisk();
      logger.info(`[Chain] Genesis block created and initial state saved.`);
    }
  } catch (err: any) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[Chain] Corrupted chain file or initialization error. Re-initializing. Error: ${error}`);
    chain = [createGenesisBlock()];
    clearLedger();
    await rebuildLedgerFromChain(chain);
    saveChain();
    saveLedgerToDisk();
    saveStakingLedgerToDisk();
  }
})();

export function getBlockchain(): Block[] { return [...chain]; }
export function getLatestBlock(): Block { return chain[chain.length - 1]; }

export async function proposeBlock(
  pendingTxs: Transaction[],
  proposerAddress: string,
  proposerPublicKey: string,
  proposerSignature: string,
  timestamp: number
): Promise<Block | null> {
  const lastBlock = getLatestBlock();
  const transactionsToInclude = pendingTxs.slice(0, GENESIS_CONFIG.maxTransactionsPerBlock);

  const totalFees = transactionsToInclude.reduce((sum, tx) => sum + tx.fee, 0);
  const blockReward = GENESIS_CONFIG.baseReward + totalFees;
  
  const rewardTx = createRewardTransaction(proposerAddress, blockReward);
  const finalTransactions = [...transactionsToInclude, rewardTx];

  const blockData: Omit<Block, 'hash' | 'signature'> = {
    index: lastBlock.index + 1,
    previousHash: lastBlock.hash,
    timestamp: timestamp,
    data: finalTransactions,
    proposer: proposerAddress,
    proposerPublicKey: proposerPublicKey,
    shardId: lastBlock.shardId,
  };

  const hash = calculateBlockHash(blockData);

  if (!verifySignature(proposerPublicKey, hash, proposerSignature)) {
    logger.error(`[Chain] Proposed block rejected: invalid signature.`);
    return null;
  }

  const newBlock: Block = { ...blockData, hash, signature: proposerSignature };

  if (getLatestBlock().hash !== newBlock.previousHash) {
    logger.error(`[Chain] Proposed block rejected: previousHash mismatch.`);
    return null;
  }

  const blockProcessed = await processBlockTransactions(newBlock);
  if (blockProcessed) {
    chain.push(newBlock);
    mempool.removeTransactions(transactionsToInclude);
    saveChain();
    saveLedgerToDisk();
    saveStakingLedgerToDisk();
    logger.info(`[Chain] Block ${newBlock.index} proposed by ${proposerAddress.slice(0, 10)}... and added to chain.`);

    const proposerValidator = getValidator(proposerAddress);
    if (proposerValidator) {
      proposerValidator.lastProposedBlock = newBlock.index;
      proposerValidator.lastProposedTimestamp = newBlock.timestamp;
      addOrUpdateValidator(proposerValidator);
    }
    
    updateEpochValidatorSet(newBlock.index, newBlock.hash);

    return newBlock;
  } else {
    return null;
  }
}

export async function isValidChain(chainToValidate: Block[]): Promise<boolean> {
  const genesis = createGenesisBlock();
  if (JSON.stringify(chainToValidate[0]) !== JSON.stringify(genesis)) {
    logger.error("[Chain] Invalid chain: Genesis block mismatch.");
    return false;
  }

  const originalBalances = new Map(_getBalancesMap());
  const originalNonces = new Map(_getNoncesMap());
  const originalContractCode = new Map(_getContractCodeMap());
  const originalContractStorage = new Map(_getContractStorageMap());
  const originalValidators = new Map(_getValidatorsMap());

  const rebuildSuccess = await rebuildLedgerFromChain(chainToValidate);

  _setBalancesMap(originalBalances);
  _setNoncesMap(originalNonces);
  _setContractCodeMap(originalContractCode);
  _setContractStorageMap(originalContractStorage);
  _setValidatorsMap(originalValidators);

  if (!rebuildSuccess) {
      logger.error(`[Chain] Invalid chain: Rebuild failed during validation (indicates a deeper issue in the chain).`);
      return false;
  }

  for (let i = 1; i < chainToValidate.length; i++) {
    const currentBlock = chainToValidate[i];
    const previousBlock = chainToValidate[i - 1];

    const { hash, signature, ...blockToHash } = currentBlock;
    const calculatedHash = calculateBlockHash(blockToHash);

    if (hash !== calculatedHash) {
      logger.error(`[Chain] Invalid chain: Hash mismatch on block ${currentBlock.index}. Expected: ${calculatedHash}, Got: ${hash}`);
      return false;
    }
    if (currentBlock.previousHash !== previousBlock.hash) {
      logger.error(`[Chain] Invalid chain: previousHash mismatch on block ${currentBlock.index}.`);
      return false;
    }
    
    const expectedProposer = chooseNextBlockProposer(previousBlock.hash);
    const proposerValidator = getValidator(currentBlock.proposer);
    
    if (currentBlock.proposer !== expectedProposer) {
      logger.error(
        `[Chain] Invalid chain: Proposer ${currentBlock.proposer.slice(0, 10)}... was not expected proposer ${expectedProposer?.slice(0, 10)}... for block ${currentBlock.index}`
      );
      return false;
    }
    if (proposerValidator?.jailed) {
        logger.error(`[Chain] Invalid chain: Proposer ${currentBlock.proposer.slice(0, 10)}... is jailed and cannot propose blocks.`);
        return false;
    }

    if (!verifySignature(currentBlock.proposerPublicKey, calculatedHash, signature)) {
      logger.error(`[Chain] Invalid chain: Block signature verification failed for block ${currentBlock.index}`);
      return false;
    }
  }
  logger.info('[Chain] Chain validation successful.');
  return true;
}

export async function replaceChain(newChain: Block[]): Promise<boolean> {
  if (newChain.length <= chain.length) {
      logger.info(`[Chain] Rejected shorter or equal length chain. Current: ${chain.length}, Candidate: ${newChain.length}`);
      return false;
  }
  
  if (await isValidChain(newChain)) {
    logger.info(`[Chain] Replacing local chain with valid longer one. New height: ${newChain.length}.`);
    chain = newChain;
    await rebuildLedgerFromChain(newChain);
    mempool.pruneExpiredTransactions();
    saveChain();
    saveLedgerToDisk();
    saveStakingLedgerToDisk();
    return true;
  }
  logger.warn(`[Chain] Candidate chain rejected as invalid.`);
  return false;
}
