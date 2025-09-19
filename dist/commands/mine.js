// src/commands/mine.ts (Corrected and Refactored for new API flow)
import chalk from "chalk";
import ora from "ora";
import { mineBlock } from "../services/apiService.js";
import { loadAndDecryptWallet } from "../utils/walletManager.js";
import { logApiError } from "../utils/cliUtils.js";
import inquirer from "inquirer";
const MINER_ADDRESS = process.env.MINER_ADDRESS || "";
export function registerMineCommand(program) {
    program
        .command("mine")
        .description("Propose a block as the configured miner")
        .action(async () => {
        if (!MINER_ADDRESS) {
            console.error(chalk.red("❌ MINER_ADDRESS environment variable is not set. Cannot mine."));
            return;
        }
        const spinner = ora(chalk.cyan(`Loading miner wallet (${MINER_ADDRESS.slice(0, 10)}...)`)).start();
        // Use loadAndDecryptWallet to get the unencrypted private key
        const wallet = await loadAndDecryptWallet(MINER_ADDRESS);
        if (!wallet) {
            spinner.fail(chalk.red(`❌ Miner wallet not found or could not be decrypted for address: ${MINER_ADDRESS}`));
            console.error(chalk.red("Ensure you have a wallet file for your MINER_ADDRESS and know its passphrase."));
            return;
        }
        spinner.succeed(chalk.green("Wallet loaded."));
        let passphrase = '';
        if (wallet.isEncrypted) {
            const { inputPassphrase } = await inquirer.prompt({
                type: 'password',
                name: 'inputPassphrase',
                message: `Enter passphrase for wallet ${wallet.address.slice(0, 10)}...:`,
                mask: '*'
            });
            passphrase = inputPassphrase;
        }
        try {
            spinner.text = chalk.cyan("Sending block proposal to node...");
            // Pass the private key and passphrase to the new /mine API endpoint
            const res = await mineBlock(wallet.address, wallet.privateKey, passphrase);
            if (res && res.block) {
                spinner.succeed(chalk.green("✅ Block proposed: ") + chalk.yellow(res.block.hash.slice(0, 10) + "..."));
                console.log(chalk.blue("📦 Block Index:"), chalk.yellow(res.block.index));
            }
            else {
                spinner.fail(chalk.red(`❌ Block proposal failed: ${res?.error || 'Unknown error'}`));
            }
        }
        catch (err) {
            spinner.fail(chalk.red("❌ An unexpected error occurred during mining."));
            logApiError("Error", err);
        }
    });
}
