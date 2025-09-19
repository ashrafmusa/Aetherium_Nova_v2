// src/Transaction.ts (Final Corrected Version)
import crypto from "crypto";
import { verifySignature, generateAddress } from "./wallet.js";
import { GENESIS_CONFIG } from "./config.js";
import logger from "./logger.js";
export var TxType;
(function (TxType) {
    TxType["TRANSFER"] = "TRANSFER";
    TxType["DEPLOY"] = "DEPLOY";
    TxType["CALL"] = "CALL";
    TxType["STAKE"] = "STAKE";
    TxType["UNSTAKE"] = "UNSTAKE";
    TxType["CLAIM_REWARDS"] = "CLAIM_REWARDS";
    TxType["REWARD"] = "REWARD";
})(TxType || (TxType = {}));
export function createRewardTransaction(proposerAddress, amount) {
    const timestamp = Date.now();
    return {
        type: TxType.REWARD,
        from: "coinbase",
        to: proposerAddress,
        amount: amount,
        fee: 0,
        nonce: 0,
        timestamp: timestamp,
        data: {},
        signature: "",
        publicKey: "",
    };
}
export function getTransactionPayload(tx) {
    const dataString = tx.data !== undefined ? JSON.stringify(tx.data) : '';
    const payload = `${tx.type}:${tx.from}:${tx.to}:${tx.amount}:${tx.fee}:${tx.nonce}:${tx.timestamp}:${dataString}:${tx.publicKey}`;
    return payload;
}
export function getTransactionId(tx) {
    return crypto.createHash("sha256").update(getTransactionPayload(tx)).digest("hex");
}
export function generateContractAddress(creatorAddress, nonce) {
    const hashInput = JSON.stringify({ creatorAddress, nonce, random: Date.now() });
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
    return `0x${hash.slice(0, 40)}`;
}
export function verifyTransaction(tx) {
    if (tx.from === "coinbase" && tx.type === TxType.REWARD) {
        return true;
    }
    if (tx.from === "coinbase" && tx.type !== TxType.REWARD) {
        logger.warn(`[TxValidation] Rejected invalid coinbase transaction type: ${tx.type}`);
        return false;
    }
    if (!tx.signature || !tx.publicKey || !tx.type || !tx.from || !tx.to) {
        logger.warn(`[TxValidation] Rejected transaction with missing critical fields. Type: ${tx.type}, From: ${tx.from}`);
        return false;
    }
    if (tx.amount < 0 || tx.fee < 0 || tx.nonce < 0) {
        logger.warn(`[TxValidation] Rejected transaction with negative amount, fee, or nonce. From: ${tx.from}`);
        return false;
    }
    if (tx.fee < GENESIS_CONFIG.minFee) {
        logger.warn(`[TxValidation] Rejected transaction below minimum fee. From: ${tx.from}, Fee: ${tx.fee}`);
        return false;
    }
    const timeSkew = Date.now() - tx.timestamp;
    if (Math.abs(timeSkew) > GENESIS_CONFIG.transactionTTL) {
        logger.warn(`[TxValidation] Rejected expired or future transaction. From: ${tx.from}, Skew: ${timeSkew}ms`);
        return false;
    }
    const derivedAddress = generateAddress(tx.publicKey);
    if (tx.from !== derivedAddress) {
        logger.warn(`[TxValidation] Rejected transaction: 'from' address does not match public key. Tx.from: ${tx.from}, Derived: ${derivedAddress}`);
        return false;
    }
    const payloadForVerification = getTransactionPayload(tx);
    if (!verifySignature(tx.publicKey, payloadForVerification, tx.signature)) {
        logger.warn(`[TxValidation] Rejected transaction: invalid signature. From: ${tx.from}, TxId: ${getTransactionId(tx)}`);
        return false;
    }
    if (tx.type === TxType.STAKE && tx.amount < (GENESIS_CONFIG.minStake ?? 0)) {
        logger.warn(`[TxValidation] Rejected STAKE transaction below minimum stake amount. Required: ${GENESIS_CONFIG.minStake}, Got: ${tx.amount}`);
        return false;
    }
    if (!Object.values(TxType).includes(tx.type)) {
        logger.warn(`[TxValidation] Rejected transaction with unknown type: ${tx.type}`);
        return false;
    }
    return true;
}
