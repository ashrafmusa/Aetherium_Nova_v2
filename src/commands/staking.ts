// src/commands/staking.ts (Corrected)
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { TxType } from "../Transaction.js";
import { GENESIS_CONFIG } from "../config.js";
import { sendTransaction, fetchNonce, unjailValidatorAPI } from "../services/apiService.js";
import { loadAndDecryptWallet } from "../utils/walletManager.js";
import { logApiError, validateAddress, validateAmountFee } from "../utils/cliUtils.js";
import { createTransaction } from "../utils/txUtils.js";

export function registerStakingCommands(program: Command) {
  program
    .command("stake")
    .argument("<from>", "Delegator address")
    .argument("<to>", "Validator address to stake to")
    .argument("<amount>", "Amount of AN to stake", parseFloat)
    .argument("<fee>", "Transaction fee", parseFloat)
    .description("Stake AN tokens to a validator")
    .action(async (from, to, amount, fee) => {
      const fromValidation = validateAddress(from, "Delegator address");
      if (fromValidation !== true) { console.error(chalk.red(`❌ ${fromValidation}`)); return; }
      const toValidation = validateAddress(to, "Validator address");
      if (toValidation !== true) { console.error(chalk.red(`❌ ${toValidation}`)); return; }
      const amountValidation = validateAmountFee(amount, "Amount", GENESIS_CONFIG.minStake);
      if (amountValidation !== true) { console.error(chalk.red(`❌ ${amountValidation}`)); return; }
      const feeValidation = validateAmountFee(fee, "Fee", GENESIS_CONFIG.minFee);
      if (feeValidation !== true) { console.error(chalk.red(`❌ ${feeValidation}`)); return; }

      const spinner = ora(chalk.cyan("Loading wallet and fetching nonce...")).start();
      const wallet = await loadAndDecryptWallet(from);
      if (!wallet) {
        spinner.fail(chalk.red(`❌ Wallet not found or could not be decrypted for address: ${from}`));
        return;
      }
      spinner.succeed(chalk.green("Wallet loaded."));

      try {
        const nonce = await fetchNonce(from);
        if (nonce === null) {
            spinner.fail(chalk.red(`❌ Failed to fetch nonce for ${from}.`));
            return;
        }
        spinner.text = chalk.cyan("Nonce fetched. Creating and sending stake transaction...");

        const tx = createTransaction(
          {
            type: TxType.STAKE,
            from,
            to,
            amount,
            fee,
            nonce,
            publicKey: wallet.publicKey,
          },
          wallet.privateKey
        );

        const res = await sendTransaction(tx);
        if (res) {
            spinner.succeed(chalk.green(`✅ Stake transaction accepted. (TxID: ${res.txId.slice(0, 10)}...)`));
        } else {
            spinner.fail(chalk.red("❌ Failed to send stake transaction."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during staking."));
        logApiError("Error", err);
      }
    });

  program
    .command("unstake")
    .argument("<from>", "Delegator address")
    .argument("<fromValidator>", "Validator address to unstake from")
    .argument("<amount>", "Amount of AN to unstake", parseFloat)
    .argument("<fee>", "Transaction fee", parseFloat)
    .description("Unstake AN tokens from a validator")
    .action(async (from, fromValidator, amount, fee) => {
      const fromValidation = validateAddress(from, "Delegator address");
      if (fromValidation !== true) { console.error(chalk.red(`❌ ${fromValidation}`)); return; }
      const fromValidatorValidation = validateAddress(fromValidator, "Validator address");
      if (fromValidatorValidation !== true) { console.error(chalk.red(`❌ ${fromValidatorValidation}`)); return; }
      const amountValidation = validateAmountFee(amount, "Amount", 0);
      if (amountValidation !== true) { console.error(chalk.red(`❌ ${amountValidation}`)); return; }
      const feeValidation = validateAmountFee(fee, "Fee", GENESIS_CONFIG.minFee);
      if (feeValidation !== true) { console.error(chalk.red(`❌ ${feeValidation}`)); return; }

      const spinner = ora(chalk.cyan("Loading wallet and fetching nonce...")).start();
      const wallet = await loadAndDecryptWallet(from);
      if (!wallet) {
        spinner.fail(chalk.red(`❌ Wallet not found or could not be decrypted for address: ${from}`));
        return;
      }
      spinner.succeed(chalk.green("Wallet loaded."));

      try {
        const nonce = await fetchNonce(from);
        if (nonce === null) {
            spinner.fail(chalk.red(`❌ Failed to fetch nonce for ${from}.`));
            return;
        }
        spinner.text = chalk.cyan("Nonce fetched. Creating and sending unstake transaction...");

        const tx = createTransaction(
          {
            type: TxType.UNSTAKE,
            from,
            to: fromValidator,
            amount,
            fee,
            nonce,
            publicKey: wallet.publicKey,
          },
          wallet.privateKey
        );

        const res = await sendTransaction(tx);
        if (res) {
            spinner.succeed(chalk.green(`✅ Unstake transaction accepted. (TxID: ${res.txId.slice(0, 10)}...)`));
        } else {
            spinner.fail(chalk.red("❌ Failed to send unstake transaction."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during unstaking."));
        logApiError("Error", err);
      }
    });

  program
    .command("claim-rewards")
    .argument("<from>", "Delegator address")
    .argument("<fromValidator>", "Validator address to claim rewards from")
    .argument("<fee>", "Transaction fee", parseFloat)
    .description("Claim accrued rewards from a validator")
    .action(async (from, fromValidator, fee) => {
      const fromValidation = validateAddress(from, "Delegator address");
      if (fromValidation !== true) { console.error(chalk.red(`❌ ${fromValidation}`)); return; }
      const fromValidatorValidation = validateAddress(fromValidator, "Validator address");
      if (fromValidatorValidation !== true) { console.error(chalk.red(`❌ ${fromValidatorValidation}`)); return; }
      const feeValidation = validateAmountFee(fee, "Fee", GENESIS_CONFIG.minFee);
      if (feeValidation !== true) { console.error(chalk.red(`❌ ${feeValidation}`)); return; }

      const spinner = ora(chalk.cyan("Loading wallet and fetching nonce...")).start();
      const wallet = await loadAndDecryptWallet(from);
      if (!wallet) {
        spinner.fail(chalk.red(`❌ Wallet not found or could not be decrypted for address: ${from}`));
        return;
      }
      spinner.succeed(chalk.green("Wallet loaded."));

      try {
        const nonce = await fetchNonce(from);
        if (nonce === null) {
            spinner.fail(chalk.red(`❌ Failed to fetch nonce for ${from}.`));
            return;
        }
        spinner.text = chalk.cyan("Nonce fetched. Creating and sending claim rewards transaction...");

        const tx = createTransaction(
          {
            type: TxType.CLAIM_REWARDS,
            from,
            to: fromValidator,
            amount: 0,
            fee,
            nonce,
            publicKey: wallet.publicKey,
          },
          wallet.privateKey
        );

        const res = await sendTransaction(tx);
        if (res) {
            spinner.succeed(chalk.green(`✅ Claim rewards transaction accepted. (TxID: ${res.txId.slice(0, 10)}...)`));
        } else {
            spinner.fail(chalk.red("❌ Failed to send claim rewards transaction."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during claiming rewards."));
        logApiError("Error", err);
      }
    });

  program
    .command("unjail <validatorAddress>")
    .description("Attempt to unjail a validator that has served its jail period.")
    .action(async (validatorAddress) => {
      const addressValidation = validateAddress(validatorAddress, "Validator address");
      if (addressValidation !== true) { console.error(chalk.red(`❌ ${addressValidation}`)); return; }

      const spinner = ora(chalk.cyan(`Attempting to unjail validator ${validatorAddress.slice(0, 10)}...`)).start();
      try {
        const res = await unjailValidatorAPI(validatorAddress);

        if (res && res.success) {
          spinner.succeed(chalk.green(`✅ Validator ${validatorAddress.slice(0, 10)}... unjailed successfully.`));
        } else {
          spinner.fail(chalk.red(`❌ Failed to unjail validator ${validatorAddress.slice(0, 10)}...: ${res?.error || 'Unknown error.'}`));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during unjail attempt."));
        logApiError("Error", err);
      }
    });
}