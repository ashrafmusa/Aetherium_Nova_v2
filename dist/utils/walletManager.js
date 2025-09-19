// src/utils/walletManager.ts
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import chalk from "chalk";
import { decryptPrivateKey, encryptPrivateKey } from "../wallet.js";
const WALLETS_DIR = path.join(process.cwd(), "wallets");
/**
 * Loads a wallet from disk, decrypts it, and returns the Wallet object.
 * Prompts for passphrase if the wallet is encrypted.
 * @param address The address of the wallet to load.
 * @returns The decrypted Wallet object, or null if not found/failed.
 */
export async function loadAndDecryptWallet(address) {
    const walletPath = path.join(WALLETS_DIR, `${address}.json`);
    if (!fs.existsSync(walletPath)) {
        return null;
    }
    try {
        const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
        if (!walletData.isEncrypted) {
            console.warn(chalk.yellow(`⚠️  WARNING: Wallet ${address.slice(0, 10)}... is NOT ENCRYPTED. It's unsafe to use without encryption.`));
            return walletData;
        }
        let passphrase = '';
        let decryptedPrivateKey = '';
        let attempts = 0;
        const MAX_ATTEMPTS = 3;
        while (attempts < MAX_ATTEMPTS) {
            const { inputPassphrase } = await inquirer.prompt({
                type: 'password',
                name: 'inputPassphrase',
                message: `Enter passphrase for wallet ${address.slice(0, 10)}...:`,
                mask: '*',
            });
            passphrase = inputPassphrase;
            try {
                decryptedPrivateKey = decryptPrivateKey(walletData.privateKey, passphrase);
                return { ...walletData, privateKey: decryptedPrivateKey, isEncrypted: false };
            }
            catch (e) {
                console.error(chalk.red("❌ Incorrect passphrase. Please try again."));
                attempts++;
            }
        }
        console.error(chalk.red(`❌ Failed to decrypt wallet after ${MAX_ATTEMPTS} attempts.`));
        return null;
    }
    catch (e) {
        console.error(chalk.red(`❌ Error loading or parsing wallet file ${address}:`), e.message);
        return null;
    }
}
/**
 * Saves a wallet to disk, encrypting the private key with a passphrase.
 * @param wallet The wallet object to save (privateKey should be the raw, unencrypted key here).
 * @param passphrase Passphrase to encrypt the private key.
 */
export function saveWalletToDisk(wallet, passphrase) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
    const filepath = path.join(WALLETS_DIR, `${wallet.address}.json`);
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, passphrase);
    const walletToSave = { ...wallet, privateKey: encryptedPrivateKey, isEncrypted: true };
    fs.writeFileSync(filepath, JSON.stringify(walletToSave, null, 2));
}
/**
 * Lists all wallet addresses found in the wallets directory.
 * @returns An array of wallet addresses (filenames without .json).
 */
export function listWallets() {
    if (!fs.existsSync(WALLETS_DIR)) {
        return [];
    }
    return fs.readdirSync(WALLETS_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
}
