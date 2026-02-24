// src/chain.ts (Final Corrected Version)
import crypto from 'crypto';
import { type Block } from './types.js';
import { type Transaction, getTransactionId, TxType, createRewardTransaction } from './Transaction.js';
import { clearLedger, processBlockTransactions, rebuildLedgerFromChain } from './ledger_processor.js';
import { saveLedgerToDisk, loadLedgerFromDisk } from './ledger.js';

import { getLogger } from './logger.js';
import { GENESIS_CONFIG } from './config.js';
import { addOrUpdateValidator, saveStakingLedgerToDisk, loadStakingLedgerFromDisk, type Validator, getValidator, updateEpochValidatorSet } from './staking.js';
import { verifySignature } from './wallet.js';
import {
  _getBalancesMap,
  _getNoncesMap,
  _getContractCodeMap,
  _getContractStorageMap,
  _setBalancesMap,
  _setNoncesMap,
  _setContractCodeMap,
  _setContractStorageMap
} from './ledger.js';
import {
  _getValidatorsMap,
  _setValidatorsMap,
  chooseNextBlockProposer
} from './staking.js';

export { Block };

const logger = getLogger();

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

import { db } from './services/database.js';

async function saveChain(): Promise<void> {
  // Only save the latest block to avoid rewriting the whole chain constantly (optimization)
  // But wait, the previous code saved the WHOLE chain every time.
  // With DB, we should just append.
  const latestBlock = chain[chain.length - 1];
  if (latestBlock) {
    await db.saveBlock(latestBlock.index, latestBlock);
  }
}

function createGenesisBlock(): Block {
  const index = 0;
  const timestamp = GENESIS_CONFIG.genesisBlockTimestamp;
  const previousHash = "0".repeat(64);
  const bootstrapTransaction: Transaction = {
    type: TxType.TRANSFER,
    from: 'coinbase',
    to: GENESIS_CONFIG.bootstrapAddress,
    amount: GENESIS_CONFIG.totalSupply,
    fee: 0,
    timestamp: timestamp,
    nonce: 0,
    signature: '0'.repeat(128),
    hash: '0'.repeat(64),
    publicKey: '0'.repeat(130)
  };
  const data: Transaction[] = [bootstrapTransaction];
  const proposer = GENESIS_CONFIG.bootstrapAddress;
  const proposerPublicKey = "";
  const signature = "0".repeat(128);
  const shardId = 0;
  const hash = calculateBlockHash({ index, previousHash, timestamp, data, proposer, proposerPublicKey, shardId });
  return { index, previousHash, timestamp, data, proposer, proposerPublicKey, hash, signature, shardId };
}

(async () => {
  try {
    const height = await db.getChainHeight();

    if (height >= 0) {
      // A height of 0 means genesis was already persisted; anything > 0 means more blocks exist.
      logger.info(`[Chain] Loading chain from DB (Height: ${height})...`);
      const loadedChain: Block[] = [];
      for (let i = 0; i <= height; i++) {
        const block = await db.getBlock(i);
        if (block) loadedChain.push(block);
        else break; // Should not happen if DB is consistent
      }

      if (loadedChain.length > 0) {
        chain = loadedChain;
        // Verify version/structure if needed, or assume DB is truth

        const ledgerLoaded = await loadLedgerFromDisk();
        const stakingLedgerLoaded = await loadStakingLedgerFromDisk();

        if (!ledgerLoaded || !stakingLedgerLoaded) {
          logger.warn('[Chain] Ledger snapshot not found or corrupted, rebuilding from chain...');
          const rebuildSuccess = await rebuildLedgerFromChain(chain);
          if (!rebuildSuccess) {
            throw new Error("Failed to rebuild ledgers from chain during startup.");
          }
          await saveLedgerToDisk();
          await saveStakingLedgerToDisk();
        }
        logger.info(`[Chain] Loaded ${chain.length} blocks from DB.`);
      } else {
        // DB has headers but no blocks? Fallback
        throw new Error("DB indicated height but no blocks found.");
      }

    } else {
      // Height is null/undefined usually implies empty DB
      // Correction: getChainHeight returns 0 if not found, forcing logic check.
      // Actually simpler: try getBlock(0).
      const genesis = await db.getBlock(0);
      if (!genesis) {
        logger.info("[Chain] No chain in DB. Creating genesis state.");
        const genesisBlock = createGenesisBlock();
        chain = [genesisBlock];
        clearLedger();
        await rebuildLedgerFromChain(chain);

        await db.saveBlock(0, genesisBlock);
        await saveLedgerToDisk();
        await saveStakingLedgerToDisk();
        logger.info(`[Chain] Genesis block created and initial state saved.`);
      }
    }
  } catch (err: any) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[Chain] DB initialization error. Error: ${error}`);
    // Fallback? Or fail hard?
    // For now, fail hard or creating new genesis might overwrite data.
    // Better to just create genesis if totally failed/empty.
    if (chain.length === 0) {
      chain = [createGenesisBlock()];
      await rebuildLedgerFromChain(chain);
      await saveStakingLedgerToDisk();
    }
  }
})();

export function getBlockchain(): Block[] { return [...chain]; }
export function getChainLength(): number { return chain.length; }
export function getLatestBlock(): Block { return chain[chain.length - 1]; }

export async function proposeBlock(
  pendingTxs: Transaction[],
  proposerAddress: string,
  proposerPublicKey: string,
  proposerSignature: string,
  timestamp: number,
  mempool: any
): Promise<Block | null> {
  const lastBlock = getLatestBlock();
  // make sure we only include user-submitted transactions (no reward tx which
  // may have been attached by a naive client).  The consensus reward is always
  // calculated server-side based on fees and the known base reward.
  const mempoolTxs = pendingTxs.filter(tx => tx.type !== TxType.REWARD);
  const transactionsToInclude = mempoolTxs.slice(0, GENESIS_CONFIG.maxTransactionsPerBlock);

  const totalFees = transactionsToInclude.reduce((sum, tx) => sum + tx.fee, 0);
  const blockReward = GENESIS_CONFIG.baseReward + totalFees;

  // build the reward transaction with the **same** timestamp that the proposer
  // assigned to the block so both sides will hash the identical structure.
  const rewardTx = createRewardTransaction(proposerAddress, blockReward);
  rewardTx.timestamp = timestamp;
  rewardTx.hash = getTransactionId(rewardTx);

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

  // `hash` is already a SHA256 string, avoid double hashing during verification
  if (!verifySignature(proposerPublicKey, hash, proposerSignature, true)) {
    logger.error(`[Chain] Proposed block rejected: invalid signature.`);
    return null;
  }

  const newBlock: Block = { ...blockData, hash, signature: proposerSignature };

  if (getLatestBlock().hash !== newBlock.previousHash) {
    logger.error(`[Chain] Proposed block rejected: previousHash mismatch.`);
    return null;
  }

  const tempBalances = new Map(_getBalancesMap());
  const tempNonces = new Map(_getNoncesMap());
  const tempContractCode = new Map(_getContractCodeMap());
  const tempContractStorage = new Map(_getContractStorageMap());
  const tempValidators = new Map(_getValidatorsMap());

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
    logger.warn(`[Chain] Proposed block ${newBlock.index} was not processed successfully. Rolling back temporary state changes.`);
    _setBalancesMap(tempBalances);
    _setNoncesMap(tempNonces);
    _setContractCodeMap(tempContractCode);
    _setContractStorageMap(tempContractStorage);
    _setValidatorsMap(tempValidators);
    return null;
  }
}

export async function isValidChain(chainToValidate: Block[]): Promise<boolean> {
  if (chainToValidate.length === 0) {
    logger.error("[Chain] Invalid chain: Chain is empty.");
    return false;
  }
  const genesis = createGenesisBlock();
  const g0 = chainToValidate[0];
  if (
    g0.index !== genesis.index ||
    g0.hash !== genesis.hash ||
    g0.previousHash !== genesis.previousHash
  ) {
    logger.error("[Chain] Invalid chain: Genesis block mismatch.");
    return false;
  }

  const originalBalances = new Map(_getBalancesMap());
  const originalNonces = new Map(_getNoncesMap());
  const originalContractCode = new Map(_getContractCodeMap());
  const originalContractStorage = new Map(_getContractStorageMap());
  const originalValidators = new Map(_getValidatorsMap());

  let rebuildSuccess = false;
  try {
    rebuildSuccess = await rebuildLedgerFromChain(chainToValidate);
  } catch (error) {
    logger.error(`[Chain] Error during chain validation rebuild: ${error}`);
    rebuildSuccess = false;
  } finally {
    _setBalancesMap(originalBalances);
    _setNoncesMap(originalNonces);
    _setContractCodeMap(originalContractCode);
    _setContractStorageMap(originalContractStorage);
    _setValidatorsMap(originalValidators);
  }


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

    if (!verifySignature(currentBlock.proposerPublicKey, calculatedHash, signature, true)) {
      logger.error(`[Chain] Invalid chain: Block signature verification failed for block ${currentBlock.index}`);
      return false;
    }
  }
  logger.info('[Chain] Chain validation successful.');
  return true;
}

export async function replaceChain(newChain: Block[], mempool: any): Promise<boolean> {
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

/**
 * Append a single externally-received block to the local chain.
 * Used by P2P broadcast so we do NOT require newChain.length > chain.length
 * (replaceChain would always reject a 1-element candidate).
 */
export async function appendBlock(block: Block, mempool: any): Promise<boolean> {
  const latestBlock = getLatestBlock();

  if (block.index !== latestBlock.index + 1) {
    logger.warn(`[Chain] appendBlock rejected: index mismatch. Expected ${latestBlock.index + 1}, got ${block.index}`);
    return false;
  }
  if (block.previousHash !== latestBlock.hash) {
    logger.warn(`[Chain] appendBlock rejected: previousHash mismatch on block ${block.index}`);
    return false;
  }

  const { hash, signature, ...blockToHash } = block;
  const calculatedHash = calculateBlockHash(blockToHash);
  if (hash !== calculatedHash) {
    logger.warn(`[Chain] appendBlock rejected: hash mismatch on block ${block.index}`);
    return false;
  }

  const expectedProposer = chooseNextBlockProposer(latestBlock.hash);
  if (block.proposer !== expectedProposer) {
    logger.warn(`[Chain] appendBlock rejected: unexpected proposer ${block.proposer.slice(0, 10)}... for block ${block.index}`);
    return false;
  }

  if (!verifySignature(block.proposerPublicKey, calculatedHash, signature)) {
    logger.warn(`[Chain] appendBlock rejected: invalid signature on block ${block.index}`);
    return false;
  }

  // Snapshot state for rollback
  const tempBalances = new Map(_getBalancesMap());
  const tempNonces = new Map(_getNoncesMap());
  const tempContractCode = new Map(_getContractCodeMap());
  const tempContractStorage = new Map(_getContractStorageMap());
  const tempValidators = new Map(_getValidatorsMap());

  const processed = await processBlockTransactions(block);
  if (processed) {
    chain.push(block);
    if (mempool) {
      mempool.removeTransactions(block.data.filter((tx: Transaction) => tx.type !== TxType.REWARD));
    }
    await saveChain();
    saveLedgerToDisk();
    saveStakingLedgerToDisk();
    const proposerValidator = getValidator(block.proposer);
    if (proposerValidator) {
      proposerValidator.lastProposedBlock = block.index;
      proposerValidator.lastProposedTimestamp = block.timestamp;
      addOrUpdateValidator(proposerValidator);
    }
    updateEpochValidatorSet(block.index, block.hash);
    logger.info(`[Chain] Block ${block.index} appended via P2P propagation.`);
    return true;
  } else {
    _setBalancesMap(tempBalances);
    _setNoncesMap(tempNonces);
    _setContractCodeMap(tempContractCode);
    _setContractStorageMap(tempContractStorage);
    _setValidatorsMap(tempValidators);
    logger.warn(`[Chain] appendBlock: transaction processing failed for block ${block.index}. State rolled back.`);
    return false;
  }
}