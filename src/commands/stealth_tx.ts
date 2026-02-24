/**
 * Encrypted Mempool CLI Commands
 *
 *  commit-tx  <from> <to> <amount> <fee>
 *    – Builds + signs a transfer, computes a blinded commitment hash,
 *      stores the pre-image locally, and submits the hash to the node.
 *    – The transaction content stays invisible until the reveal step.
 *
 *  reveal-tx  <commitment>
 *    – Loads the locally-stored pre-image and reveals it to the node.
 *    – The node verifies the hash, then adds the tx to the real mempool.
 *
 * This prevents MEV / front-running: observers see only a hash until the
 * block-delay window elapses.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { TxType } from '../Transaction.js';
import { GENESIS_CONFIG } from '../config.js';
import { commitTransaction, revealTransaction, fetchNonce } from '../services/apiService.js';
import { loadAndDecryptWallet } from '../utils/walletManager.js';
import { logApiError, validateAddress, validateAmountFee } from '../utils/cliUtils.js';
import { createTransaction } from '../utils/txUtils.js';
import { generateCommitSecret, computeCommitment } from '../commitment_pool.js';

/** Directory where pending commit pre-images are saved */
const COMMITS_DIR = path.resolve(process.cwd(), '.aetherium-commits');

function ensureCommitsDir() {
    if (!fs.existsSync(COMMITS_DIR)) fs.mkdirSync(COMMITS_DIR, { recursive: true });
}

function commitFilePath(commitment: string): string {
    return path.join(COMMITS_DIR, `${commitment.slice(0, 16)}.json`);
}

export function registerStealthTxCommands(program: Command) {
    // ── commit-tx ────────────────────────────────────────────────────────────────
    program
        .command('commit-tx')
        .argument('<from>', 'Sender address (0x…)')
        .argument('<to>', 'Recipient address (0x…)')
        .argument('<amount>', 'Amount of AN to transfer', parseFloat)
        .argument('<fee>', 'Transaction fee in AN', parseFloat)
        .description(
            'Anti-MEV transfer: submit a blinded commitment hash now; reveal after ≥1 block.\n' +
            '  Step 1 of 2 — the actual transaction remains private until reveal-tx is run.',
        )
        .action(async (from: string, to: string, amount: number, fee: number) => {
            // ── Input validation ──
            const v1 = validateAddress(from, 'Sender');
            if (v1 !== true) { console.error(chalk.red(`❌ ${v1}`)); return; }
            const v2 = validateAddress(to, 'Recipient');
            if (v2 !== true) { console.error(chalk.red(`❌ ${v2}`)); return; }
            const v3 = validateAmountFee(amount, 'Amount', 0);
            if (v3 !== true) { console.error(chalk.red(`❌ ${v3}`)); return; }
            const v4 = validateAmountFee(fee, 'Fee', GENESIS_CONFIG.minFee);
            if (v4 !== true) { console.error(chalk.red(`❌ ${v4}`)); return; }

            const spinner = ora(chalk.cyan('Loading wallet and building transaction…')).start();

            const passphrase = process.env.WALLET_PASSWORD;
            const wallet = await loadAndDecryptWallet(from, passphrase);
            if (!wallet) {
                spinner.fail(chalk.red(`❌ Wallet not found or could not be decrypted for ${from}`));
                return;
            }
            spinner.text = chalk.cyan('Fetching nonce…');

            const nonce = await fetchNonce(from);
            if (nonce === null) {
                spinner.fail(chalk.red('❌ Could not fetch nonce from node.'));
                return;
            }

            // Build and sign the full transaction
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
                    hash: '',
                },
                wallet.privateKey,
            );

            // Generate blinding secret and compute commitment
            const secret = generateCommitSecret();
            const txJson = JSON.stringify(tx);
            const commitment = computeCommitment(txJson, secret);

            // Persist pre-image locally (needed for the reveal step)
            ensureCommitsDir();
            const saveFile = commitFilePath(commitment);
            fs.writeFileSync(saveFile, JSON.stringify({ commitment, secret, txJson }, null, 2), 'utf8');

            spinner.text = chalk.cyan('Submitting commitment to node…');
            const result = await commitTransaction(commitment, from, fee);
            if (!result?.ok) {
                spinner.fail(chalk.red(`❌ Commitment rejected: ${result?.message ?? 'unknown error'}`));
                // Remove the saved file so there's no orphan
                fs.unlinkSync(saveFile);
                return;
            }

            spinner.succeed(chalk.green('✔ Commitment accepted by node.'));
            console.log('');
            console.log(chalk.bold('  Commitment ID  ') + chalk.cyan(commitment));
            console.log(chalk.bold('  Reveal after   ') + chalk.yellow(`block ${result.revealAfterBlock}`));
            console.log(chalk.bold('  Expires at     ') + chalk.yellow(`block ${result.expiresAtBlock}`));
            console.log(chalk.bold('  Pre-image saved') + ` ${saveFile}`);
            console.log('');
            console.log(
                chalk.dim(
                    `  Step 2 — run after block ${result.revealAfterBlock} is mined:\n` +
                    `  node dist/cli.js reveal-tx ${commitment}`,
                ),
            );
        });

    // ── reveal-tx ────────────────────────────────────────────────────────────────
    program
        .command('reveal-tx')
        .argument('<commitment>', 'The 64-hex-char commitment ID returned by commit-tx')
        .description(
            'Anti-MEV transfer: reveal the blinded transaction (step 2 of 2).\n' +
            '  Reads the locally-saved pre-image and reveals it to the node.',
        )
        .action(async (commitment: string) => {
            if (!/^[0-9a-f]{64}$/i.test(commitment)) {
                console.error(chalk.red('❌ Commitment must be a 64-char hex string.'));
                return;
            }

            const saveFile = commitFilePath(commitment);
            if (!fs.existsSync(saveFile)) {
                console.error(chalk.red(`❌ No saved pre-image found for ${commitment.slice(0, 16)}…`));
                console.error(chalk.dim(`   Expected file: ${saveFile}`));
                return;
            }

            let data: { commitment: string; secret: string; txJson: string };
            try {
                data = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
            } catch {
                console.error(chalk.red('❌ Failed to read pre-image file. It may be corrupted.'));
                return;
            }

            if (data.commitment !== commitment) {
                console.error(chalk.red('❌ Commitment in file does not match the provided commitment.'));
                return;
            }

            const spinner = ora(chalk.cyan('Revealing transaction to node…')).start();

            const tx = JSON.parse(data.txJson);
            const result = await revealTransaction(commitment, tx, data.secret);

            if (!result?.ok) {
                spinner.fail(chalk.red(`❌ Reveal failed: ${result?.message ?? 'unknown error'}`));
                return;
            }

            spinner.succeed(chalk.green('✔ Transaction revealed and accepted by node!'));
            console.log('');
            console.log(chalk.bold('  TxID  ') + chalk.cyan(result.txId));
            console.log(chalk.dim('  Mine a block to confirm the transaction.'));

            // Clean up local pre-image file
            try { fs.unlinkSync(saveFile); } catch { /* ignore */ }
        });
}
