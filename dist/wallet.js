// src/wallet.ts (Final Corrected Version)
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
// --- Core Cryptographic Functions ---
/**
 * Generates a new secp256k1 key pair and derives a blockchain address.
 * Keys are generated in PEM format.
 * @returns A new Wallet object with public/private keys and address.
 */
export function createWallet() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    const publicKeyPem = publicKey.toString();
    const privateKeyPem = privateKey.toString();
    const address = generateAddress(publicKeyPem);
    return { privateKey: privateKeyPem, publicKey: publicKeyPem, address, isEncrypted: false };
}
/**
 * Generates a blockchain address from a public key.
 * The address is the first 40 characters of the SHA-256 hash of the public key, prefixed with '0x'.
 * @param publicKeyPem The public key PEM string.
 * @returns The blockchain address.
 */
export function generateAddress(publicKeyPem) {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    const der = publicKey.export({ type: "spki", format: "der" });
    return `0x${crypto.createHash("sha256").update(der).digest("hex").slice(0, 40)}`;
}
/**
 * Signs a payload with a private key.
 * The private key must be in PEM format.
 * @param privateKeyPem The private key in PEM format.
 * @param payload The data to be signed.
 * @returns The signature string.
 */
export function signTransaction(privateKeyPem, payload) {
    const sign = crypto.createSign("SHA256");
    sign.update(payload);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return sign.sign(privateKey).toString("hex");
}
/**
 * Verifies a signature against a payload and public key.
 * The public key must be in PEM format.
 * @param publicKeyPem The public key in PEM format.
 * @param payload The original data.
 * @param signatureHex The signature to verify.
 * @returns True if the signature is valid, otherwise false.
 */
export function verifySignature(publicKeyPem, payload, signatureHex) {
    try {
        const verify = crypto.createVerify("SHA256");
        verify.update(payload);
        verify.end();
        const publicKey = crypto.createPublicKey(publicKeyPem);
        const signature = Buffer.from(signatureHex, "hex");
        return verify.verify(publicKey, signature);
    }
    catch (e) {
        console.error("Signature verification failed:", e);
        return false;
    }
}
/**
 * Encrypts a private key using AES with a passphrase.
 * @param privateKey The private key to encrypt.
 * @param passphrase The passphrase for encryption.
 * @returns The encrypted private key.
 */
export function encryptPrivateKey(privateKey, passphrase) {
    if (!passphrase || passphrase.length < 8) {
        throw new Error("Passphrase must be at least 8 characters long for encryption.");
    }
    return CryptoJS.AES.encrypt(privateKey, passphrase).toString();
}
/**
 * Decrypts an encrypted private key using a passphrase.
 * @param encryptedPrivateKey The encrypted private key.
 * @param passphrase The passphrase for decryption.
 * @returns The decrypted private key.
 * @throws An error if the decryption fails (e.g., incorrect passphrase).
 */
export function decryptPrivateKey(encryptedPrivateKey, passphrase) {
    if (!passphrase) {
        throw new Error("Passphrase is required to decrypt the private key.");
    }
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, passphrase);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted.includes('PRIVATE KEY')) {
            throw new Error("Decryption failed or incorrect passphrase.");
        }
        return decrypted;
    }
    catch (e) {
        throw new Error("Decryption failed or incorrect passphrase.");
    }
}
