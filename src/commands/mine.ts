// src/commands/mine.ts (Corrected)

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { proposeBlockAPI, getLatestBlock, getMempoolTransactions } from "../services/apiService.js";
import { loadAndDecryptWallet } from "../utils/walletManager.js";
import { logApiError } from "../utils/cliUtils.js";
import { createRewardTransaction } from "../Transaction.js";
import { calculateBlockHash } from "../chain.js";
import { GENESIS_CONFIG } from "../config.js";
import { signTransaction } from "../wallet.js";
import inquirer from "inquirer";
import { getValidator } from "../staking.js";

const MINER_ADDRESS = process.env.MINER_ADDRESS || "";

export function registerMineCommand(program: Command) {
  program
    .command("mine")
    .description("Propose a block as the configured miner")
    .action(async () => {
      if (!MINER_ADDRESS) {
        console.error(chalk.red("❌ MINER_ADDRESS environment variable is not set. Cannot mine."));
        return;
      }
      
      const spinner = ora(chalk.cyan(`Loading miner wallet (${MINER_ADDRESS.slice(0, 10)}...)`)).start();
      const wallet = await loadAndDecryptWallet(MINER_ADDRESS);

      if (!wallet) {
        spinner.fail(chalk.red(`❌ Miner wallet not found or could not be decrypted for address: ${MINER_ADDRESS}`));
        console.error(chalk.red("Ensure you have a wallet file for your MINER_ADDRESS and know its passphrase."));
        return;
      }
      spinner.succeed(chalk.green("Wallet loaded."));
      
      try {
        spinner.text = chalk.cyan("Fetching latest block and mempool...");
        const latestBlock = await getLatestBlock();
        const pendingTxs = await getMempoolTransactions();
        if (!latestBlock || !pendingTxs) {
            spinner.fail(chalk.red("❌ Failed to fetch latest block or mempool from node."));
            return;
        }

        const transactionsToInclude = pendingTxs.slice(0, GENESIS_CONFIG.maxTransactionsPerBlock);
        const totalFees = transactionsToInclude.reduce((sum, tx) => sum + tx.fee, 0);
        const blockReward = GENESIS_CONFIG.baseReward + totalFees;
        const rewardTx = createRewardTransaction(MINER_ADDRESS, blockReward);
        const finalTransactions = [...transactionsToInclude, rewardTx];

        const blockPayloadToSign = {
            index: latestBlock.index + 1,
            previousHash: latestBlock.hash,
            timestamp: Date.now(),
            data: finalTransactions,
            proposer: MINER_ADDRESS,
            proposerPublicKey: wallet.publicKey,
            shardId: latestBlock.shardId,
        };

        const blockHash = calculateBlockHash(blockPayloadToSign);
        const blockSignature = signTransaction(wallet.privateKey, blockHash);
        
        const newBlock = { ...blockPayloadToSign, hash: blockHash, signature: blockSignature };

        spinner.text = chalk.cyan("Signing and sending block proposal to node...");

        const res = await proposeBlockAPI(newBlock);

        if (res && res.block) {
            spinner.succeed(chalk.green("✅ Block proposed: ") + chalk.yellow(res.block.hash.slice(0, 10) + "..."));
            console.log(chalk.blue("📦 Block Index:"), chalk.yellow(res.block.index));
        } else {
            spinner.fail(chalk.red(`❌ Block proposal failed: ${res?.error || 'Unknown error'}`));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during mining."));
        logApiError("Error", err);
      }
    });
}
