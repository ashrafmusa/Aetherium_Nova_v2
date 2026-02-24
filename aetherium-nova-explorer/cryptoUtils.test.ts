
import {
    generateKeyPair,
    getTransactionHash,
    sign,
    verify,
    getBlockHash,
    calculateMerkleRoot,
} from './cryptoUtils';
import type { Transaction, Block } from './types';

describe('cryptoUtils', () => {
    it('should generate a valid key pair', () => {
        const { publicKey, secretKey } = generateKeyPair();
        expect(publicKey).toBeDefined();
        expect(secretKey).toBeDefined();
        expect(publicKey.length).toBe(3904); // ML-DSA65 public key: 1952 bytes × 2 hex chars
        expect(secretKey.length).toBe(64);  // seed: 32 bytes × 2 hex chars
    });

    it('should create a consistent transaction hash', () => {
        const tx = {
            from: 'address1',
            to: 'address2',
            amount: 100,
            timestamp: Date.now(),
            type: 'TRANSFER' as const,
        };
        const hash1 = getTransactionHash(tx);
        const hash2 = getTransactionHash(tx);
        expect(hash1).toBe(hash2);
    });

    it('should sign and verify a transaction hash', () => {
        const { publicKey, secretKey } = generateKeyPair();
        const tx = {
            from: publicKey,
            to: 'address2',
            amount: 100,
            timestamp: Date.now(),
            type: 'TRANSFER' as const,
        };
        const hash = getTransactionHash(tx);
        const signature = sign(hash, secretKey);
        expect(verify(hash, signature, publicKey)).toBe(true);
    });

    it('should fail verification with the wrong key', () => {
        const { publicKey: publicKey1, secretKey } = generateKeyPair();
        const { publicKey: publicKey2 } = generateKeyPair();
        const tx = {
            from: publicKey1,
            to: 'address2',
            amount: 100,
            timestamp: Date.now(),
            type: 'TRANSFER' as const,
        };
        const hash = getTransactionHash(tx);
        const signature = sign(hash, secretKey);
        expect(verify(hash, signature, publicKey2)).toBe(false);
    });

    it('should create a consistent block hash', () => {
        const block: Omit<Block, 'hash' | 'validatorSignature'> = {
            index: 1,
            timestamp: Date.now(),
            transactions: [],
            previousHash: '0'.repeat(64),
            merkleRoot: '0'.repeat(64),
            validator: 'validator-address',
        };
        const hash1 = getBlockHash(block);
        const hash2 = getBlockHash(block);
        expect(hash1).toBe(hash2);
    });

    it('should calculate the correct Merkle root for an empty list', () => {
        const root = calculateMerkleRoot([]);
        expect(root).toBe('0'.repeat(64));
    });

    it('should calculate the correct Merkle root for a list of transactions', () => {
        const transactions: Transaction[] = [
            { hash: 'a', from: 'a', to: 'b', amount: 1, timestamp: 1, type: 'TRANSFER', signature: 's' },
            { hash: 'b', from: 'a', to: 'b', amount: 1, timestamp: 1, type: 'TRANSFER', signature: 's' },
            { hash: 'c', from: 'a', to: 'b', amount: 1, timestamp: 1, type: 'TRANSFER', signature: 's' },
        ];
        const root = calculateMerkleRoot(transactions);
        expect(root).toBeDefined();
        expect(root.length).toBe(64);
    });
});