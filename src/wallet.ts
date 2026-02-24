
// Post-quantum digital signatures: CRYSTALS-Dilithium ML-DSA65
// NIST FIPS 204 — Level 3 security (equivalent to AES-192)
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getLogger } from './logger.js';

const log = getLogger();
const WALLETS_DIR = path.resolve(process.cwd(), 'wallets');

// --- Wallet Data Structures ---

export interface Wallet {
  publicKey: string; // Hex string — ML-DSA65 public key (1952 bytes = 3904 hex chars)
  privateKey: string; // Hex string — 32-byte seed (64 hex chars) that derives the keypair
  address: string;
  isEncrypted: boolean;
}

// --- Core Cryptographic Functions ---

/**
 * Generates a new ML-DSA65 (CRYSTALS-Dilithium) key pair and derives a blockchain address.
 * The "private key" stored is the 32-byte seed from which the full keypair is deterministically
 * derived — keeping encrypted storage compact while remaining fully post-quantum secure.
 * @returns A new Wallet with publicKey, privateKey (seed), and address.
 */
export function createWallet(): Wallet {
  const seed = crypto.randomBytes(32);
  const { publicKey: pubKeyBytes } = ml_dsa65.keygen(seed);
  const publicKey = Buffer.from(pubKeyBytes).toString('hex');
  const privateKey = seed.toString('hex'); // 32 bytes = 64 hex chars
  const address = generateAddress(publicKey);
  return { privateKey, publicKey, address, isEncrypted: false };
}

/**
 * Re-derives the ML-DSA65 public key from a 32-byte seed.
 * @param seedHex The wallet seed (private key) in Hex format.
 * @returns The ML-DSA65 public key in Hex format.
 */
export function getPublicKeyFromPrivate(seedHex: string): string {
  const seed = Buffer.from(seedHex, 'hex');
  const { publicKey } = ml_dsa65.keygen(seed);
  return Buffer.from(publicKey).toString('hex');
}

/**
 * Generates a blockchain address from a public key.
 * The address is the first 40 characters of the SHA-256 hash of the public key, prefixed with '0x'.
 * @param publicKeyHex The public key Hex string.
 * @returns The blockchain address.
 */
export function generateAddress(publicKeyHex: string): string {
  // SHA-256 of the raw public key bytes → first 40 hex chars → 0x prefix
  // SHA-256 provides 128-bit post-quantum security via Grover's algorithm.
  const buffer = Buffer.from(publicKeyHex, 'hex');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

/**
 * Signs a payload using ML-DSA65 (CRYSTALS-Dilithium).
 * The "seed" (private key) is used to deterministically derive the full ML-DSA65 secret key.
 * Dilithium applies SHAKE-256 internally — no pre-hashing is required or performed.
 * The `alreadyHashed` parameter is kept for API compatibility but is ignored.
 * @param seedHex The 32-byte wallet seed in Hex format.
 * @param payload The data to sign (raw string).
 * @returns The ML-DSA65 signature in Hex format.
 */
export function signTransaction(seedHex: string, payload: string, alreadyHashed = false): string {
  const seed = Buffer.from(seedHex, 'hex');
  const { secretKey } = ml_dsa65.keygen(seed);
  const msgBytes = Buffer.from(payload, 'utf8');
  const sig = ml_dsa65.sign(msgBytes, secretKey);
  return Buffer.from(sig).toString('hex');
}

/**
 * Verifies an ML-DSA65 (CRYSTALS-Dilithium) signature.
 * The `alreadyHashed` parameter is kept for API compatibility but is ignored.
 * @param publicKeyHex The ML-DSA65 public key in Hex format.
 * @param payload The original signed data (raw string).
 * @param signatureHex The signature in Hex format.
 * @returns True if valid, false otherwise.
 */
export function verifySignature(publicKeyHex: string, payload: string, signatureHex: string, alreadyHashed = false): boolean {
  try {
    const pubKey = Buffer.from(publicKeyHex, 'hex');
    const msgBytes = Buffer.from(payload, 'utf8');
    const sig = Buffer.from(signatureHex, 'hex');
    return ml_dsa65.verify(sig, msgBytes, pubKey);
  } catch (e) {
    log.error('ML-DSA65 signature verification failed: ' + String(e));
    return false;
  }
}

/**
 * Encrypts a private key using AES-256-GCM.
 * @param privateKeyHex The private key.
 * @param passphrase The passphrase.
 * @returns The encrypted string.
 */
export function encryptPrivateKey(privateKeyHex: string, passphrase: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha512');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyHex, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${salt.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a private key.
 * @param encryptedData The encrypted string.
 * @param passphrase The passphrase.
 * @returns The decrypted private key.
 */
export function decryptPrivateKey(encryptedData: string, passphrase: string): string {
  const [ivHex, saltHex, authTagHex, encryptedHex] = encryptedData.split(':');
  if (!ivHex || !saltHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted data format.');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const salt = Buffer.from(saltHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha512');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}