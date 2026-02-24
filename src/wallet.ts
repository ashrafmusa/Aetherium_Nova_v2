
import elliptic from 'elliptic';
const { ec: EC } = elliptic;
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getLogger } from './logger.js';

const log = getLogger();
const ec = new EC('secp256k1');
const WALLETS_DIR = path.resolve(process.cwd(), 'wallets');

// --- Wallet Data Structures ---

export interface Wallet {
  publicKey: string; // Hex string
  privateKey: string; // Hex string
  address: string;
  isEncrypted: boolean;
}

// --- Core Cryptographic Functions ---

/**
 * Generates a new secp256k1 key pair and derives a blockchain address.
 * Keys are generated in Hex format.
 * @returns A new Wallet object with public/private keys and address.
 */
export function createWallet(): Wallet {
  const keyPair = ec.genKeyPair();
  const publicKey = keyPair.getPublic('hex');
  const privateKey = keyPair.getPrivate('hex');
  const address = generateAddress(publicKey);

  return { privateKey, publicKey, address, isEncrypted: false };
}

/**
 * Derives the public key from a private key.
 * @param privateKeyHex The private key in Hex format.
 * @returns The public key in Hex format.
 */
export function getPublicKeyFromPrivate(privateKeyHex: string): string {
  const key = ec.keyFromPrivate(privateKeyHex, 'hex');
  return key.getPublic('hex');
}

/**
 * Generates a blockchain address from a public key.
 * The address is the first 40 characters of the SHA-256 hash of the public key, prefixed with '0x'.
 * @param publicKeyHex The public key Hex string.
 * @returns The blockchain address.
 */
export function generateAddress(publicKeyHex: string): string {
  // Simple Sha256 of the Hex string (consistent with frontend simple approach)
  // Ensure we hash the BUFFER of the hex string if that's what we want, or the string itself?
  // Frontend nodeService mock used: const hash = sha256(Buffer.from(publicKey, 'hex')); (In my mental model)
  // Let's check frontend cryptoUtils: it uses `sha256(txString)`. 
  // Standard AetheriumNova likely just hashes the string or bytes.
  // I will hash the hex string as distinct bytes.
  // Buffer.from(hex, 'hex')

  const buffer = Buffer.from(publicKeyHex, 'hex');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

/**
 * Signs a payload with a private key.
 * @param privateKeyHex The private key in Hex format.
 * @param payload The data to be signed (string).
 * @returns The signature string (DER Hex).
 */
export function signTransaction(privateKeyHex: string, payload: string, alreadyHashed = false): string {
  // If the caller has already computed the SHA‑256 hash of the payload (e.g. when
  // mining a block) they can set `alreadyHashed` to true so we don't hash a hash
  // again.  All other callers should leave this false and supply the raw string.
  // The frontend `sign` helper also operates on a hash, so when the UI generates
  // a signature it hashes first and passes that value in.

  const payloadHash = alreadyHashed
    ? payload
    : crypto.createHash('sha256').update(payload).digest('hex');
  const key = ec.keyFromPrivate(privateKeyHex, 'hex');
  const signature = key.sign(payloadHash, 'hex');
  return signature.toDER('hex');
}

/**
 * Verifies a signature against a payload and public key.
 * @param publicKeyHex The public key in Hex format.
 * @param payload The original data (raw string).
 * @param signatureHex The signature to verify (DER Hex).
 * @returns True if the signature is valid, otherwise false.
 */
export function verifySignature(publicKeyHex: string, payload: string, signatureHex: string, alreadyHashed = false): boolean {
  try {
    const payloadHash = alreadyHashed
      ? payload
      : crypto.createHash('sha256').update(payload).digest('hex');
    const key = ec.keyFromPublic(publicKeyHex, 'hex');
    return key.verify(payloadHash, signatureHex);
  } catch (e) {
    console.error("Signature verification failed:", e);
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