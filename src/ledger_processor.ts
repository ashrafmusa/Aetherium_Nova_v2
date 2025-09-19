// src/ledger_processor.ts (Corrected)
import { type Block } from "./chain.js";
import { TxType, generateContractAddress, getTransactionId } from "./Transaction.js";
import { setBalance, setNonce, getBalance, getContractCode, getContractStorage, setContractStorage, clearLedger as clearLedgerState, getNonceForAddress, _getBalancesMap, _getNoncesMap, _getContractCodeMap, _getContractStorageMap, _setBalancesMap, _setNoncesMap, _setContractCodeMap, _setContractStorageMap } from "./ledger.js";
import { executeContract } from "./vm.js";
import { GENESIS_CONFIG } from "./config.js";
import logger from "./logger.js";
import { addOrUpdateValidator, getValidator, distributeRewards, clearStakingLedger, type Validator, slashValidator } from "./staking.js";
import { setContractCode } from "./ledger.js";
export { clearLedgerState as clearLedger };

export function processBlockTransactions(block: Block): boolean {
    const seenTxIds = new Set<string>();

    for (const tx of block.data) {
        // --- Pre-execution Checks (Crucial) ---
        const txId = getTransactionId(tx);
        if (seenTxIds.has(txId)) {
            logger.error(`[Ledger] Duplicate transaction ${txId.slice(0, 10)} in block ${block.index}. Block invalid.`);
            slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
            return false;
        }
        seenTxIds.add(txId);

        if (tx.from === 'coinbase' || tx.type === TxType.REWARD) {
            if (tx.type !== TxType.REWARD) {
              logger.warn(`[TxValidation] Rejected invalid coinbase/reward transaction type: ${tx.type}`);
              return false;
            }
            setBalance(tx.to, getBalance(tx.to) + tx.amount);
            // Distribute rewards here if needed
            continue;
        }

        const expectedNonce = getNonceForAddress(tx.from);
        if (tx.nonce !== expectedNonce) {
            logger.error(`[Ledger] Invalid nonce for tx from ${tx.from}. Expected ${expectedNonce}, got ${tx.nonce}. Block invalid.`);
            slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
            return false;
        }

        let fromBalance = getBalance(tx.from);
        let amountToDeduct = tx.amount + tx.fee;
        
        if (tx.type === TxType.UNSTAKE || tx.type === TxType.CLAIM_REWARDS) {
            amountToDeduct = tx.fee;
        }

        if (fromBalance < amountToDeduct) {
            logger.error(`[Ledger] Insufficient balance for tx ${txId.slice(0, 10)} from ${tx.from}. Required ${amountToDeduct}, Available ${fromBalance}. Block invalid.`);
            slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
            return false;
        }
        // --- End Pre-execution Checks ---

        setBalance(tx.from, fromBalance - amountToDeduct);
        setNonce(tx.from, tx.nonce + 1);
        
        switch (tx.type) {
            case TxType.TRANSFER:
                setBalance(tx.to, getBalance(tx.to) + tx.amount);
                break;

            case TxType.STAKE: {
                const validatorToStake = getValidator(tx.to) ?? { address: tx.to, totalStake: 0, delegators: new Map(), jailed: false, slashCount: 0, publicKey: tx.publicKey };
                const delegator = validatorToStake.delegators.get(tx.from) ?? { address: tx.from, amount: 0, rewards: 0 };
                delegator.amount += tx.amount;
                validatorToStake.totalStake += tx.amount;
                validatorToStake.delegators.set(tx.from, delegator);
                addOrUpdateValidator(validatorToStake);
                logger.info(`[Ledger] ${tx.from.slice(0, 10)}... staked ${tx.amount} to ${tx.to.slice(0, 10)}.... New total stake: ${validatorToStake.totalStake}`);
                break;
            }

            case TxType.UNSTAKE: {
                const validatorToUnstake = getValidator(tx.to);
                if (!validatorToUnstake?.delegators.has(tx.from)) {
                    logger.error(`[Ledger] No delegation found for ${tx.from} on ${tx.to}. Block invalid.`);
                    slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
                    return false;
                }
                const delegatorToUnstake = validatorToUnstake.delegators.get(tx.from)!;
                if (delegatorToUnstake.amount < tx.amount) {
                    logger.error(`[Ledger] Unstake amount ${tx.amount} exceeds delegation ${delegatorToUnstake.amount} for ${tx.from} on ${tx.to}. Block invalid.`);
                    slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
                    return false;
                }
                delegatorToUnstake.amount -= tx.amount;
                validatorToUnstake.totalStake -= tx.amount;
                setBalance(tx.from, getBalance(tx.from) + tx.amount);
                if (delegatorToUnstake.amount === 0 && delegatorToUnstake.rewards === 0) {
                    validatorToUnstake.delegators.delete(tx.from);
                }
                addOrUpdateValidator(validatorToUnstake);
                logger.info(`[Ledger] ${tx.from.slice(0, 10)}... unstaked ${tx.amount} from ${tx.to.slice(0, 10)}.... Remaining stake: ${delegatorToUnstake.amount}`);
                break;
            }

            case TxType.CLAIM_REWARDS: {
                const validatorToClaim = getValidator(tx.to);
                if (!validatorToClaim?.delegators.has(tx.from)) {
                    logger.error(`[Ledger] No delegation found for ${tx.from} on ${tx.to} to claim rewards. Block invalid.`);
                    slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
                    return false;
                }
                const delegatorToClaim = validatorToClaim.delegators.get(tx.from)!;
                const rewards = delegatorToClaim.rewards;
                if (rewards > 0) {
                    setBalance(tx.from, getBalance(tx.from) + rewards);
                    delegatorToClaim.rewards = 0;
                    addOrUpdateValidator(validatorToClaim);
                    logger.info(`[Ledger] ${tx.from.slice(0, 10)}... claimed ${rewards.toFixed(4)} AN rewards from ${tx.to.slice(0, 10)}....`);
                }
                break;
            }

            case TxType.DEPLOY:
                if (!tx.data?.code) {
                    logger.error(`[Ledger] Deploy transaction missing contract code. Block invalid.`);
                    slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
                    return false;
                }
                const contractAddress = generateContractAddress(tx.from, tx.nonce);
                if (getContractCode(contractAddress)) {
                    logger.error(`[Ledger] Contract address ${contractAddress.slice(0, 10)}... already in use. Block invalid.`);
                    slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
                    return false;
                }
                setContractCode(contractAddress, tx.data.code);
                setBalance(contractAddress, getBalance(contractAddress) + tx.amount);
                setContractStorage(contractAddress, new Map<string, any>());
                logger.info(`[Ledger] Contract deployed by ${tx.from.slice(0, 10)}... at ${contractAddress.slice(0, 10)}....`);
                break;

            case TxType.CALL:
                setBalance(tx.to, getBalance(tx.to) + tx.amount);
                const code = getContractCode(tx.to);
                if (!code) {
                    logger.error(`[Ledger] Call to non-existent contract ${tx.to.slice(0, 10)}.... Block invalid.`);
                    slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
                    return false;
                }
                
                const currentContractStorage = getContractStorage(tx.to);
                const executionResult = executeContract(code, tx, block, currentContractStorage);
                
                if (!executionResult.success) {
                    logger.error(`[Ledger] Contract execution failed for tx ${txId.slice(0, 10)}... on contract ${tx.to.slice(0, 10)}...: ${executionResult.error}`);
                    slashValidator(block.proposer, GENESIS_CONFIG.slashPercentage);
                    return false;
                } else {
                    setContractStorage(tx.to, executionResult.storage);
                    logger.info(`[Ledger] Contract call for tx ${txId.slice(0, 10)}... on ${tx.to.slice(0, 10)}... successful. Gas used: ${executionResult.gasUsed}`);
                    if (executionResult.logs.length > 0) {
                        logger.info(`[Ledger] Contract logs for ${txId.slice(0, 10)}...: ${JSON.stringify(executionResult.logs)}`);
                    }
                }
                break;
        }
    }

    if (block.proposer && block.proposer !== "0".repeat(40) && block.index !== 0) {
        const blockReward = GENESIS_CONFIG.baseReward + block.data.reduce((sum, tx) => sum + tx.fee, 0);
        distributeRewards(block.proposer, blockReward);
    }
    return true;
}

export function rebuildLedgerFromChain(chain: Block[]): boolean {
  clearLedgerState();
  clearStakingLedger();

  const BOOTSTRAP_ADDRESS = GENESIS_CONFIG.bootstrapAddress;
  const BOOTSTRAP_FUNDS = GENESIS_CONFIG.bootstrapFunds;

  setBalance(BOOTSTRAP_ADDRESS, BOOTSTRAP_FUNDS);
  setNonce(BOOTSTRAP_ADDRESS, 0);

  if (GENESIS_CONFIG.bootstrapStake && GENESIS_CONFIG.bootstrapStake > 0) {
    setBalance(BOOTSTRAP_ADDRESS, getBalance(BOOTSTRAP_ADDRESS) - GENESIS_CONFIG.bootstrapStake);
    // CORRECTED: Added publicKey to genesisValidator initialization
    const genesisValidator: Validator = {
        address: BOOTSTRAP_ADDRESS,
        totalStake: GENESIS_CONFIG.bootstrapStake,
        delegators: new Map([
            [BOOTSTRAP_ADDRESS, { address: BOOTSTRAP_ADDRESS, amount: GENESIS_CONFIG.bootstrapStake, rewards: 0 }]
        ]),
        jailed: false,
        slashCount: 0,
        publicKey: '0'.repeat(64) // Placeholder for genesis
    };
    addOrUpdateValidator(genesisValidator);
    logger.info('[Ledger Rebuild] Applied genesis pre-mine and validator stake.');
  } else {
    logger.info('[Ledger Rebuild] Applied genesis pre-mine without initial validator stake.');
  }

  logger.info('[Ledger] Starting ledger rebuild from chain...');
  for (const block of chain.slice(1)) {
    if (!processBlockTransactions(block)) {
      logger.error(`[Ledger] Rebuild failed at block ${block.index}. This should not happen if chain is valid.`);
      return false;
    }
  }
  logger.info('[Ledger] Rebuild complete.');
  return true;
}