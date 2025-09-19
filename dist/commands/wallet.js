import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import { createWallet } from "../wallet.js";
import { saveWalletToDisk, listWallets } from "../utils/walletManager.js";
export function registerWalletCommands(program) {
    program
        .command("create-wallet")
        .description("Generate a new wallet and encrypt it with a passphrase.")
        .action(async () => {
        const wallet = createWallet();
        console.log(chalk.blue("New wallet generated."));
        console.log(chalk.blue("Public Key:"), wallet.publicKey);
        console.log(chalk.blue("Address:"), wallet.address);
        let passphrase = '';
        const { inputPassphrase } = await inquirer.prompt({
            type: 'password',
            name: 'inputPassphrase',
            message: 'Enter a strong passphrase to encrypt your private key (min 8 chars):',
            mask: '*',
            validate: (input) => input.length >= 8 || 'Passphrase must be at least 8 characters long.',
        });
        passphrase = inputPassphrase;
        const { confirmPassphrase } = await inquirer.prompt({
            type: 'password',
            name: 'confirmPassphrase',
            message: 'Confirm your passphrase:',
            mask: '*',
            validate: (input) => input === passphrase || 'Passphrases do not match.',
        });
        if (inputPassphrase !== confirmPassphrase) {
            console.error(chalk.red("❌ Passphrases did not match. Wallet not saved."));
            return;
        }
        try {
            saveWalletToDisk(wallet, passphrase);
            console.log(chalk.green("🔐 Wallet saved and encrypted to:"), path.join("wallets", `${wallet.address}.json`));
            console.log(chalk.green("📫 Address:"), wallet.address);
        }
        catch (error) {
            console.error(chalk.red("❌ Failed to save wallet:"), error.message);
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
