// src/commands/query.ts (Corrected)
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { logApiError, validateAddress } from "../utils/cliUtils.js";
import { getBalance, fetchNonce, getBlock, getContractState, getStatus, callReadOnlyContractMethod } from "../services/apiService.js";

export function registerQueryCommands(program: Command) {
  program
    .command("get-balance <address>")
    .description("Get the balance of a given address")
    .action(async (address) => {
      const addressValidation = validateAddress(address);
      if (addressValidation !== true) { console.error(chalk.red(`❌ ${addressValidation}`)); return; }

      const spinner = ora(chalk.cyan(`Fetching balance for ${address.slice(0, 10)}...`)).start();
      try {
        const balance = await getBalance(address);
        if (balance !== null) {
            spinner.succeed(chalk.green(`💰 Balance of ${address}: ${chalk.yellow(balance)} units`));
        } else {
            spinner.fail(chalk.red(`❌ Failed to fetch balance for ${address}.`));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred while fetching balance."));
        logApiError("Error", err);
      }
    });

  program
    .command("get-nonce <address>")
    .description("Get the current nonce for an address")
    .action(async (address) => {
      const addressValidation = validateAddress(address);
      if (addressValidation !== true) { console.error(chalk.red(`❌ ${addressValidation}`)); return; }

      const spinner = ora(chalk.cyan(`Fetching nonce for ${address.slice(0, 10)}...`)).start();
      try {
        const nonce = await fetchNonce(address);
        if (nonce !== null) {
            spinner.succeed(chalk.green(`🔢 Nonce for ${address}: ${chalk.yellow(nonce)}`));
        } else {
            spinner.fail(chalk.red(`❌ Failed to fetch nonce for ${address}.`));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred while fetching nonce."));
        logApiError("Error", err);
      }
    });

  program
    .command("get-block <index>")
    .description("Get details of a block by its index")
    .action(async (indexStr) => {
      const index = parseInt(indexStr, 10);
      if (isNaN(index) || index < 0) {
        console.error(chalk.red("❌ Block index must be a non-negative number."));
        return;
      }

      const spinner = ora(chalk.cyan(`Fetching block ${index}...`)).start();
      try {
        const block = await getBlock(index);
        if (block) {
            spinner.succeed(chalk.green(`📦 Block ${index} Details:`));
            console.log(chalk.blue(`  Hash: ${chalk.yellow(block.hash)}`));
            console.log(chalk.blue(`  Previous Hash: ${chalk.yellow(block.previousHash)}`));
            console.log(chalk.blue(`  Timestamp: ${chalk.yellow(new Date(block.timestamp).toLocaleString())}`));
            console.log(chalk.blue(`  Proposer: ${chalk.yellow(block.proposer)}`));
            console.log(chalk.blue(`  Transactions: ${chalk.yellow(block.data.length)}`));
            block.data.forEach((tx: any, i: number) => {
              console.log(chalk.gray(`    Tx ${i + 1}: Type=${tx.type}, From=${tx.from.slice(0, 10)}..., To=${tx.to.slice(0, 10)}..., Amount=${tx.amount}, Fee=${tx.fee}`));
            });
        } else {
            spinner.fail(chalk.red(`❌ Failed to fetch block ${index}.`));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred while fetching block."));
        logApiError("Error", err);
      }
    });

  program
    .command("get-contract-state <address>")
    .description("Get the current storage state of a smart contract")
    .action(async (address) => {
      const addressValidation = validateAddress(address, "Contract address");
      if (addressValidation !== true) { console.error(chalk.red(`❌ ${addressValidation}`)); return; }

      const spinner = ora(chalk.cyan(`Fetching contract state for ${address.slice(0, 10)}...`)).start();
      try {
        const contractData = await getContractState(address);
        if (contractData) {
            spinner.succeed(chalk.green(`📝 Contract State for ${address}:`));
            if (Object.keys(contractData.storage).length === 0) {
              console.log(chalk.blue("  No state variables found."));
            } else {
              console.log(chalk.yellow(JSON.stringify(contractData.storage, null, 2)));
            }
        } else {
            spinner.fail(chalk.red(`❌ Failed to fetch contract state for ${address}.`));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred while fetching contract state."));
        logApiError("Error", err);
      }
    });

  program
    .command("status")
    .description("Get the current status of the Aetherium Nova node.")
    .action(async () => {
      const spinner = ora(chalk.cyan("Fetching node status...")).start();
      try {
        const status = await getStatus();
        if (status) {
          spinner.succeed(chalk.green("✅ Node Status:"));
          console.log(chalk.blue(`  Blockchain Height: ${chalk.yellow(status.height)}`));
          console.log(chalk.blue(`  Connected Peers: ${chalk.yellow(status.peers)}`));
          console.log(chalk.blue(`  Mempool Size: ${chalk.yellow(status.mempool)}`));
        } else {
          spinner.fail(chalk.red("❌ Failed to fetch node status."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred while fetching status."));
        logApiError("Error", err);
      }
    });
}