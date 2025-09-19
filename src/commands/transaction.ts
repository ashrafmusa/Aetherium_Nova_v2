// src/commands/transaction.ts (Corrected)
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { TxType, generateContractAddress } from "../Transaction.js";
import { GENESIS_CONFIG } from "../config.js";
import { sendTransaction, fetchNonce, callReadOnlyContractMethod } from "../services/apiService.js";
import { loadAndDecryptWallet } from "../utils/walletManager.js";
import { logApiError, validateAddress, validateAmountFee } from "../utils/cliUtils.js";
import { createTransaction } from "../utils/txUtils.js";

export function registerTransactionCommands(program: Command) {
  program
    .command("transfer")
    .argument("<from>", "Sender address")
    .argument("<to>", "Recipient address")
    .argument("<amount>", "Amount to transfer", parseFloat)
    .argument("<fee>", "Transaction fee", parseFloat)
    .description("Transfer funds between addresses")
    .action(async (from, to, amount, fee) => {
      const fromValidation = validateAddress(from, "Sender address");
      if (fromValidation !== true) { console.error(chalk.red(`❌ ${fromValidation}`)); return; }
      const toValidation = validateAddress(to, "Recipient address");
      if (toValidation !== true) { console.error(chalk.red(`❌ ${toValidation}`)); return; }
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
        spinner.text = chalk.cyan("Nonce fetched. Creating and sending transaction...");

        const tx = createTransaction(
          {
            type: TxType.TRANSFER,
            from,
            to,
            amount,
            fee,
            nonce,
            data: {},
            publicKey: wallet.publicKey,
          },
          wallet.privateKey
        );

        const res = await sendTransaction(tx);
        if (res) {
            spinner.succeed(chalk.green(`✅ Transfer transaction accepted. (TxID: ${res.txId.slice(0, 10)}...)`));
        } else {
            spinner.fail(chalk.red("❌ Failed to send transfer transaction."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during transfer."));
        logApiError("Error", err);
      }
    });

  program
    .command("deploy")
    .argument("<from>", "Deployer address")
    .argument("<filepath>", "Path to TS contract")
    .argument("<fee>", "Transaction fee", parseFloat)
    .option("-a, --amount <amount>", "Initial amount to send to the contract (optional)", parseFloat, 0)
    .description("Deploy a smart contract")
    .action(async (from, filepath, fee, options) => {
      const fromValidation = validateAddress(from, "Deployer address");
      if (fromValidation !== true) { console.error(chalk.red(`❌ ${fromValidation}`)); return; }
      if (!fs.existsSync(filepath)) { console.error(chalk.red(`❌ Contract source file not found at: ${filepath}`)); return; }
      const feeValidation = validateAmountFee(fee, "Fee", GENESIS_CONFIG.minFee);
      if (feeValidation !== true) { console.error(chalk.red(`❌ ${feeValidation}`)); return; }
      const amount = options.amount;
      const amountValidation = validateAmountFee(amount, "Amount", 0);
      if (amountValidation !== true) { console.error(chalk.red(`❌ ${amountValidation}`)); return; }

      const contractBaseName = path.basename(filepath, '.ts');
      const compiledContractPath = path.join(
        process.cwd(),
        'dist',
        'contracts',
        contractBaseName + '.js'
      );

      let code: string;
      try {
        code = fs.readFileSync(compiledContractPath, "utf-8");
      } catch (e: any) {
        console.error(chalk.red("❌ Failed to read COMPILED contract file. Did you run 'npm run build'?:"), e.message);
        return;
      }
      
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
        spinner.text = chalk.cyan("Nonce fetched. Creating and sending deployment transaction...");

        const contractAddress = generateContractAddress(from, nonce);
        const contractClassName = contractBaseName;

        const tx = createTransaction(
          {
            type: TxType.DEPLOY,
            from,
            to: contractAddress,
            amount,
            fee,
            nonce,
            data: {
              code: code,
              contractClassName: contractClassName,
            },
            publicKey: wallet.publicKey,
          },
          wallet.privateKey
        );

        const res = await sendTransaction(tx);
        if (res) {
            spinner.succeed(chalk.green(`✅ Deployment transaction accepted. (Contract Address: ${res.contractAddress?.slice(0, 10)}...)`));
        } else {
            spinner.fail(chalk.red("❌ Failed to send deployment transaction."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during deployment."));
        logApiError("Error", err);
      }
    });

  program
    .command("call-contract")
    .argument("<from>", "Caller address")
    .argument("<contract>", "Contract address")
    .argument("<method>", "Method name to call")
    .argument("<fee>", "Transaction fee", parseFloat)
    .option("-a, --amount <amount>", "Amount to send to the contract (optional)", parseFloat, 0)
    .argument("[params...]", "Arguments for the contract method (JSON parsed if possible)")
    .description("Call a method on a smart contract")
    .action(async (from, contract, method, fee, options, inputParams) => {
      const fromValidation = validateAddress(from, "Caller address");
      if (fromValidation !== true) { console.error(chalk.red(`❌ ${fromValidation}`)); return; }
      const contractValidation = validateAddress(contract, "Contract address");
      if (contractValidation !== true) { console.error(chalk.red(`❌ ${contractValidation}`)); return; }
      const feeValidation = validateAmountFee(fee, "Fee", GENESIS_CONFIG.minFee);
      if (feeValidation !== true) { console.error(chalk.red(`❌ ${feeValidation}`)); return; }
      const amount = options.amount;
      const amountValidation = validateAmountFee(amount, "Amount", 0);
      if (amountValidation !== true) { console.error(chalk.red(`❌ ${amountValidation}`)); return; }
      if (!method || typeof method !== 'string') { console.error(chalk.red("❌ Method name is required.")); return; }

      const params = inputParams.map((p: string) => {
        try {
          return JSON.parse(p);
        } catch (e) {
          return p;
        }
      });

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
        spinner.text = chalk.cyan("Nonce fetched. Creating and sending contract call transaction...");

        const tx = createTransaction(
          {
            type: TxType.CALL,
            from,
            to: contract,
            amount,
            fee,
            nonce,
            data: { method, params },
            publicKey: wallet.publicKey,
          },
          wallet.privateKey
        );

        const res = await sendTransaction(tx);
        if (res) {
            spinner.succeed(chalk.green(`✅ Contract call transaction accepted. (TxID: ${res.txId.slice(0, 10)}...)`));
        } else {
            spinner.fail(chalk.red("❌ Failed to send contract call transaction."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during contract call."));
        logApiError("Error", err);
      }
    });

  program
    .command("read-contract")
    .argument("<contract>", "Contract address")
    .argument("<method>", "Method name to call (read-only)")
    .argument("[params...]", "Arguments for the contract method (JSON parsed if possible)")
    .description("Call a read-only method on a smart contract")
    .action(async (contract, method, inputParams) => {
      const contractValidation = validateAddress(contract, "Contract address");
      if (contractValidation !== true) { console.error(chalk.red(`❌ ${contractValidation}`)); return; }
      if (!method || typeof method !== 'string') { console.error(chalk.red("❌ Method name is required.")); return; }

      const params = inputParams.map((p: string) => {
        try {
          return JSON.parse(p);
        } catch (e) {
          return p;
        }
      });

      const spinner = ora(chalk.cyan(`Calling read-only method '${method}' on contract ${contract.slice(0, 10)}...`)).start();

      try {
        const res = await callReadOnlyContractMethod(contract, method, params);
        if (res) {
            spinner.succeed(chalk.green("✅ Read-only call successful."));
            if (res.returnValue !== undefined) {
                console.log(chalk.blue("📊 Return Value:"), chalk.yellow(JSON.stringify(res.returnValue, null, 2)));
            }
            if (res.logs && res.logs.length > 0) {
                console.log(chalk.blue("📝 Contract Logs:"));
                res.logs.forEach((log: any) => console.log(chalk.gray(`  - ${JSON.stringify(log)}`)));
            }
        } else {
            spinner.fail(chalk.red("❌ Read-only contract call failed."));
        }
      } catch (err: any) {
        spinner.fail(chalk.red("❌ An unexpected error occurred during read-only call."));
        logApiError("Error", err);
      }
    });
}