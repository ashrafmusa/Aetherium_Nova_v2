/**
 * Encrypted Mempool — Commit-Reveal Protocol
 *
 * Prevents MEV / front-running at the protocol level:
 *
 *  1. Sender computes:
 *       commitment = sha3-256( JSON.stringify(tx) + ":" + secretHex )
 *     and submits it to  POST /mempool/commit
 *
 *  2. After COMMIT_DELAY_BLOCKS blocks the sender reveals the full transaction
 *     via  POST /mempool/reveal/:commitment
 *
 *  3. Node verifies the pre-image, adds the tx to the normal mempool, and
 *     broadcasts it.  Miners / observers cannot front-run because the tx
 *     content is unknown until the reveal.
 */

import { createHash, randomBytes } from 'node:crypto';
import { getLogger } from './logger.js';

const logger = getLogger();

/** Minimum blocks that must be mined between commit and reveal. */
export const COMMIT_DELAY_BLOCKS = 1;

/** A commitment expires if not revealed within this many blocks. */
export const COMMITMENT_TTL_BLOCKS = 50;

export interface CommitmentEntry {
    /** SHA3-256( JSON.stringify(tx) + ":" + secretHex ) */
    commitment: string;
    /** Sender address (informational / fee-priority only) */
    from: string;
    /** Fee hint so mempool can prioritise reveals */
    fee: number;
    /** Chain height at commit time */
    submittedBlock: number;
    /** True once the pre-image has been successfully verified */
    revealed: boolean;
}

/**
 * Generate a random 32-byte hex secret for use as the blinding factor.
 * Call this client-side before computing the commitment.
 */
export function generateCommitSecret(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Compute the commitment hash from a serialised transaction JSON string
 * and a 32-byte hex secret.
 */
export function computeCommitment(txJson: string, secretHex: string): string {
    return createHash('sha3-256').update(txJson + ':' + secretHex).digest('hex');
}

class CommitmentPool {
    private entries = new Map<string, CommitmentEntry>();

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Register a commitment hash.  The full transaction is NOT required yet.
     * Returns the block at which the reveal may be submitted.
     */
    commit(
        commitment: string,
        from: string,
        fee: number,
        currentBlock: number,
    ): { ok: boolean; message: string; revealAfterBlock: number; expiresAtBlock: number } {
        if (!/^[0-9a-f]{64}$/i.test(commitment)) {
            return { ok: false, message: 'Commitment must be a 64-hex-char SHA3-256 hash.', revealAfterBlock: 0, expiresAtBlock: 0 };
        }
        if (this.entries.has(commitment)) {
            return { ok: false, message: 'Commitment already registered.', revealAfterBlock: 0, expiresAtBlock: 0 };
        }
        const revealAfterBlock = currentBlock + COMMIT_DELAY_BLOCKS;
        const expiresAtBlock = currentBlock + COMMITMENT_TTL_BLOCKS;
        this.entries.set(commitment, { commitment, from, fee, submittedBlock: currentBlock, revealed: false });
        logger.info(`[CommitPool] Commitment ${commitment.slice(0, 12)}\u2026 accepted at block ${currentBlock}. Reveal after block ${revealAfterBlock}.`);
        return { ok: true, message: 'Commitment accepted.', revealAfterBlock, expiresAtBlock };
    }

    /**
     * Verify the pre-image (txJson + secret) against a registered commitment.
     * Does NOT add the transaction to the mempool — the caller is responsible.
     */
    verify(commitment: string, txJson: string, secretHex: string): boolean {
        const computed = createHash('sha3-256').update(txJson + ':' + secretHex).digest('hex');
        return computed === commitment;
    }

    /** Mark a commitment as revealed after the transaction has been accepted. */
    markRevealed(commitment: string): void {
        const entry = this.entries.get(commitment);
        if (entry) entry.revealed = true;
    }

    getEntry(commitment: string): CommitmentEntry | undefined {
        return this.entries.get(commitment);
    }

    /** Remove expired (unrevealed, timed-out) commitments. */
    pruneExpired(currentBlock: number): number {
        let pruned = 0;
        for (const [k, v] of this.entries) {
            if (!v.revealed && currentBlock > v.submittedBlock + COMMITMENT_TTL_BLOCKS) {
                this.entries.delete(k);
                pruned++;
            }
        }
        if (pruned > 0) {
            logger.info(`[CommitPool] Pruned ${pruned} expired commitment(s) at block ${currentBlock}.`);
        }
        return pruned;
    }

    pendingCount(): number {
        let n = 0;
        for (const v of this.entries.values()) if (!v.revealed) n++;
        return n;
    }

    totalCount(): number { return this.entries.size; }
}

export const commitmentPool = new CommitmentPool();
