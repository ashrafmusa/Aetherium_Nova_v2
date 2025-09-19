// encryptBootstrap.js
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { encryptPrivateKey, decryptPrivateKey } from './dist/wallet.js'; // Assuming dist/wallet.js is compiled

const WALLETS_DIR = path.join(process.cwd(), 'wallets');
const BOOTSTRAP_ADDRESS = '0xe5bca44e2313297f074536a776e8732b275505b5';
const BOOTSTRAP_WALLET_PATH = path.join(WALLETS_DIR, `${BOOTSTRAP_ADDRESS}.json`);

async function encryptBootstrapWallet() {
    if (!fs.existsSync(BOOTSTRAP_WALLET_PATH)) {
        console.error(chalk.red(`❌ Bootstrap wallet file not found at: ${BOOTSTRAP_WALLET_PATH}`));
        console.error(chalk.red("Please ensure the node has run at least once to create the genesis state."));
        return;
    }

    try {
        const walletData = JSON.parse(fs.readFileSync(BOOTSTRAP_WALLET_PATH, 'utf-8'));

        if (walletData.isEncrypted) {
            console.log(chalk.yellow(`⚠️ Bootstrap wallet is already encrypted. No action needed.`));
            return;
        }

        console.log(chalk.blue(`Encrypting bootstrap wallet: ${BOOTSTRAP_ADDRESS}`));

        const { passphrase } = await inquirer.prompt({
            type: 'password',
            name: 'passphrase',
            message: 'Enter a passphrase to encrypt the bootstrap private key (min 8 chars):',
            mask: '*',
            validate: (input) => input.length >= 8 || 'Passphrase must be at least 8 characters long.'
        });

        const { confirmPassphrase } = await inquirer.prompt({
            type: 'password',
            name: 'confirmPassphrase',
            message: 'Confirm your passphrase:',
            mask: '*',
            validate: (input) => input === passphrase || 'Passphrases do not match.'
        });

        if (passphrase !== confirmPassphrase) {
            console.error(chalk.red("❌ Passphrases did not match. Encryption aborted."));
            return;
        }

        const encryptedPrivateKey = encryptPrivateKey(walletData.privateKey, passphrase);
        const updatedWalletData = { ...walletData, privateKey: encryptedPrivateKey, isEncrypted: true };

        fs.writeFileSync(BOOTSTRAP_WALLET_PATH, JSON.stringify(updatedWalletData, null, 2));
        console.log(chalk.green(`✅ Bootstrap wallet ${BOOTSTRAP_ADDRESS} successfully encrypted!`));
        console.log(chalk.green(`Remember this passphrase for mining and transfers from this address.`));

    } catch (error) {
        console.error(chalk.red(`❌ Error encrypting bootstrap wallet: ${error.message}`));
    }
}

encryptBootstrapWallet();