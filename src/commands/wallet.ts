
// src/commands/wallet.ts
import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import { createWallet } from "../wallet.js";
import { saveWalletToDisk, listWallets } from "../utils/walletManager.js";
import { logApiError, validateAddress } from "../utils/cliUtils.js";

export function registerWalletCommands(program: Command) {
  program
    .command("create-wallet")
    .description("Generate a new wallet and encrypt it with a passphrase.")
    .action(async () => {
      const wallet = createWallet();
      console.log(chalk.blue("🔑 New wallet keys generated."));
      console.log(chalk.blue("Public Key:"), wallet.publicKey.slice(0, 50) + "...");
      console.log(chalk.blue("Address:"), chalk.green(wallet.address));

      let passphrase = process.env.WALLET_PASSWORD;

      if (!passphrase) {
        const answer = await inquirer.prompt([
          {
            type: 'password',
              name: 'passphrase',
              message: 'Enter a passphrase to encrypt your wallet:',
              mask: '*',
              validate: (input) => input.length > 0 ? true : "Passphrase cannot be empty."
            }
          ]);
        passphrase = answer.passphrase;
      } else {
        console.log(chalk.yellow("Using passphrase from WALLET_PASSWORD environment variable."));
      }

      try {
        if (passphrase) {
            saveWalletToDisk(wallet, passphrase);
          console.log(chalk.green(`✅ Wallet saved to /wallets/${wallet.address}.json`));
        }
      } catch (err: any) {
        console.error(chalk.red("Failed to save wallet:"), err.message);
      }
    });

  program
    .command("list-wallets")
    .description("List all local wallet addresses found in the 'wallets' directory.")
    .action(() => {
      const wallets = listWallets();
      if (wallets.length === 0) {
        console.log(chalk.blue("No wallets found in the 'wallets' directory."));
        console.log(chalk.blue("Use 'aetherium-nova create-wallet' to generate one."));
        return;
      }
      console.log(chalk.blue("📁 Your Aetherium Nova Wallets:"));
      wallets.forEach(address => console.log(`- ${address}`));
    });
}