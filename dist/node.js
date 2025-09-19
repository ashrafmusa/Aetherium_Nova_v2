// src/node.ts (Corrected)
import express from 'express';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import * as client from 'prom-client';
import cors from 'cors';
import { z, ZodError } from 'zod';
import { getTransactionId, TxType } from './Transaction.js';
import { getBlockchain, proposeBlock, calculateBlockHash, replaceChain, getLatestBlock } from './chain.js';
import { getBalance, getNonceForAddress, getContractCode, getContractStorage, saveLedgerToDisk } from './ledger.js';
import mempool from './pool.js';
import { broadcastBlock, broadcastTransaction, getPeers, connectToPeer, syncWithPeers, gossipPeers } from './network.js';
import { NETWORK_CONFIG, GENESIS_CONFIG } from './config.js';
import logger from './logger.js';
import { createWallet, signTransaction, decryptPrivateKey } from './wallet.js';
import { chooseNextBlockProposer, unjailValidator, getValidator } from './staking.js';
import { apiKeyAuth } from './auth.js';
import { executeContract } from './vm.js';
// Catch and log any uncaught exceptions before the process exits
process.on('uncaughtException', (err) => {
    logger.error(`[Node] Uncaught Exception: ${err.message}`, { stack: err.stack });
    // It's good practice to exit here, but we will let the process run for now
    // to get the log out. In production, this would be a graceful exit.
});
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(apiKeyAuth);
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: "Too many requests from this IP, please try again after a minute.",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
const PORT = process.env.PORT || NETWORK_CONFIG.defaultPort;
client.collectDefaultMetrics();
const transactionsProcessed = new client.Counter({ name: 'aetherium_nova_transactions_processed_total', help: 'Total transactions processed' });
const blocksMined = new client.Counter({ name: 'aetherium_nova_blocks_mired_total', help: 'Total blocks mined' });
const mempoolGauge = new client.Gauge({ name: 'aetherium_nova_mempool_size', help: 'Current mempool size' });
setInterval(() => mempoolGauge.set(mempool.getPool().length), 5000);
setInterval(() => gossipPeers(), NETWORK_CONFIG.gossipIntervalMs ?? 30000);
(async () => {
    try {
        await syncWithPeers();
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[Node] Initial sync failed: ${error}`);
    }
})();
process.on('SIGINT', async () => {
    logger.info('SIGINT received. Saving state and shutting down...');
    await saveLedgerToDisk();
    process.exit(0);
});
const rawTransactionSchema = z.object({
    type: z.nativeEnum(TxType),
    from: z.string().startsWith('0x').length(42),
    to: z.string().startsWith('0x').length(42),
    amount: z.number().nonnegative(),
    fee: z.number().nonnegative(),
    nonce: z.number().int().nonnegative(),
    timestamp: z.number().int().nonnegative(),
    data: z.any().optional(),
    signature: z.string().min(1),
    publicKey: z.string().min(1),
});
const mineBlockSchema = z.object({
    proposerAddress: z.string().startsWith('0x').length(42),
    proposerPrivateKey: z.string().min(1),
});
const addPeerSchema = z.object({
    url: z.string().url({ message: "Invalid peer URL format." }),
});
const blockReceiveSchema = z.object({
    index: z.number().int().nonnegative(),
    previousHash: z.string().length(64),
    timestamp: z.number().int().nonnegative(),
    data: z.array(rawTransactionSchema),
    hash: z.string().length(64),
    proposer: z.string().startsWith('0x').length(42),
    proposerPublicKey: z.string(),
    signature: z.string(),
    shardId: z.number().int().nonnegative().optional(),
});
const unjailSchema = z.object({
    address: z.string().startsWith('0x').length(42, { message: "Address must be 42 characters long and start with 0x" }),
});
app.post('/create-wallet', (req, res) => {
    try {
        const wallet = createWallet();
        logger.info(`[API] Created new temporary wallet: ${wallet.address}`);
        res.json({ publicKey: wallet.publicKey, address: wallet.address, message: "Wallet created. Private key not exposed via API." });
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[API] Failed to create wallet: ${error}`);
        res.status(500).json({ error: "Failed to create wallet." });
    }
});
app.get('/balance/:address', (req, res) => {
    const { address = "" } = req.params;
    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
        return res.status(400).json({ error: "Invalid address format. Must be 42 characters and start with '0x'." });
    }
    const balance = getBalance(address);
    res.json({ address, balance });
});
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', client.register.contentType).end(await client.register.metrics());
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[API] /metrics failed: ${error}`);
        res.status(500).json({ error: "Failed to retrieve metrics." });
    }
});
app.get('/status', (req, res) => {
    res.json({
        height: getBlockchain().length,
        peers: getPeers().length,
        mempool: mempool.getPool().length
    });
});
app.get('/chain', (req, res) => {
    res.json({ version: "2.0", chain: getBlockchain() });
});
app.get('/latestBlock', (req, res) => {
    res.json(getLatestBlock());
});
app.get('/mempool', (req, res) => {
    res.json({ pool: mempool.getPool() });
});
app.get('/nonce/:address', (req, res) => {
    const { address = "" } = req.params;
    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
        return res.status(400).json({ error: "Invalid address format. Must be 42 characters and start with '0x'." });
    }
    res.json({ address, nonce: getNonceForAddress(address) });
});
app.get('/contract/:address', (req, res) => {
    const { address = "" } = req.params;
    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
        return res.status(400).json({ error: "Invalid address format. Must be 42 characters and start with '0x'." });
    }
    const code = getContractCode(address);
    if (!code) {
        return res.status(404).json({ error: "Contract not found." });
    }
    const storageAsObject = Object.fromEntries(getContractStorage(address));
    res.json({ address, storage: storageAsObject });
});
app.post('/transaction', (req, res) => {
    try {
        const tx = rawTransactionSchema.parse(req.body);
        const result = mempool.addToPool(tx);
        if (result.success) {
            transactionsProcessed.inc();
            mempoolGauge.set(mempool.getPool().length);
            broadcastTransaction(tx);
            if (tx.type === TxType.DEPLOY) {
                return res.status(202).json({ message: "Deploy transaction accepted", contractAddress: tx.to, txId: getTransactionId(tx) });
            }
            res.status(202).json({ message: "Transaction accepted.", txId: getTransactionId(tx) });
        }
        else {
            logger.warn(`[API] Transaction rejected: ${result.message}`);
            res.status(400).json({ error: result.message });
        }
    }
    catch (err) {
        if (err instanceof ZodError) {
            const zodError = err;
            logger.warn(`[API] /transaction validation error: ${zodError.issues.map((e) => e.message).join(', ')}`);
            return res.status(400).json({ error: "Validation failed", details: zodError.issues });
        }
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[API] /transaction failed: ${error}`);
        res.status(500).json({ error: "Internal server error." });
    }
});
app.post('/mine', async (req, res) => {
    try {
        const { proposerAddress } = mineBlockSchema.parse(req.body);
        const proposerPrivateKey = req.body.proposerPrivateKey;
        const passphrase = req.headers['x-passphrase'];
        if (!proposerPrivateKey || !passphrase) {
            return res.status(400).json({ error: "Missing proposerPrivateKey or passphrase." });
        }
        let privateKey;
        try {
            privateKey = decryptPrivateKey(proposerPrivateKey, passphrase);
        }
        catch (e) {
            logger.warn(`[API] Mine request rejected: Failed to decrypt private key for ${proposerAddress.slice(0, 10)}...`);
            return res.status(400).json({ error: "Invalid passphrase." });
        }
        const lastBlock = getBlockchain()[getBlockchain().length - 1];
        const expectedProposer = chooseNextBlockProposer(lastBlock.hash);
        if (expectedProposer !== proposerAddress) {
            logger.warn(`[API] Mine request rejected: ${proposerAddress.slice(0, 10)}... is not the expected proposer. Expected: ${expectedProposer?.slice(0, 10)}...`);
            return res.status(403).json({ error: "Not the current block proposer." });
        }
        const transactionsToInclude = mempool.getPool().slice(0, GENESIS_CONFIG.maxTransactionsPerBlock);
        const proposerValidator = getValidator(proposerAddress);
        if (!proposerValidator || !proposerValidator.publicKey) {
            logger.error(`[API] Block proposal failed: Proposer ${proposerAddress.slice(0, 10)}... not a valid validator.`);
            return res.status(400).json({ error: "Proposer not a valid validator." });
        }
        const proposerPublicKey = proposerValidator.publicKey;
        const blockPayloadToSign = {
            index: lastBlock.index + 1,
            previousHash: lastBlock.hash,
            timestamp: Date.now(),
            data: transactionsToInclude,
            proposer: proposerAddress,
            proposerPublicKey: proposerPublicKey,
            shardId: lastBlock.shardId
        };
        const blockHash = calculateBlockHash(blockPayloadToSign);
        const blockSignature = signTransaction(privateKey, blockHash);
        const newBlock = await proposeBlock(transactionsToInclude, proposerAddress, proposerPublicKey, blockSignature, blockPayloadToSign.timestamp);
        if (newBlock) {
            blocksMined.inc();
            mempoolGauge.set(mempool.getPool().length);
            broadcastBlock(newBlock);
            logger.info(`[API] Block ${newBlock.index} proposed successfully.`);
            res.json({ message: "Block proposed.", block: newBlock });
        }
        else {
            logger.error(`[API] Block proposal failed for ${proposerAddress}.`);
            res.status(500).json({ error: "Block proposal failed, potentially due to invalid transactions or internal error." });
        }
    }
    catch (err) {
        if (err instanceof ZodError) {
            const zodError = err;
            logger.warn(`[API] /mine validation error: ${zodError.issues.map((e) => e.message).join(', ')}`);
            return res.status(400).json({ error: "Validation failed", details: zodError.issues });
        }
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[API] /mine failed: ${error}`);
        res.status(500).json({ error: "Internal server error." });
    }
});
app.post('/addPeer', async (req, res) => {
    try {
        const { url } = addPeerSchema.parse(req.body);
        await connectToPeer(url);
        res.json({ message: `Peer ${url} added and sync initiated.` });
    }
    catch (err) {
        if (err instanceof ZodError) {
            const zodError = err;
            logger.warn(`[API] /addPeer validation error: ${zodError.issues.map((e) => e.message).join(', ')}`);
            return res.status(400).json({ error: "Validation failed", details: zodError.issues });
        }
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[API] /addPeer failed: ${error}`);
        res.status(500).json({ error: "Internal server error." });
    }
});
app.post('/block', async (req, res) => {
    try {
        const block = blockReceiveSchema.parse(req.body);
        if (block.hash !== calculateBlockHash(block)) {
            logger.warn(`[API] Received block ${block.index} from peer with invalid hash. Expected: ${calculateBlockHash(block)}, Got: ${block.hash}`);
            return res.status(400).json({ error: "Invalid block hash." });
        }
        const currentChain = getBlockchain();
        const newChainCandidate = [...currentChain, block];
        const replaced = await replaceChain(newChainCandidate);
        if (replaced) {
            broadcastBlock(block, req.hostname);
            res.status(200).json({ message: "Block accepted as new head." });
        }
        else {
            res.status(200).json({ message: "Block received but not accepted (not longer/more difficulty chain or invalid)." });
        }
    }
    catch (err) {
        if (err instanceof ZodError) {
            const zodError = err;
            logger.warn(`[API] /block validation error: ${zodError.issues.map((e) => e.message).join(', ')}`);
            return res.status(400).json({ error: "Validation failed", details: zodError.issues });
        }
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[API] /block failed: ${error}`);
        res.status(500).json({ error: "Internal server error." });
    }
});
app.get('/contract/:address/call/:method', (req, res) => {
    const { address = "" } = req.params;
    const method = req.params.method;
    let params = [];
    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
        return res.status(400).json({ error: "Invalid contract address format." });
    }
    if (!method || typeof method !== 'string') {
        return res.status(400).json({ error: "Method name is required." });
    }
    if (req.query.args) {
        try {
            params = JSON.parse(req.query.args);
            if (!Array.isArray(params)) {
                throw new Error("Parameters must be a JSON array.");
            }
        }
        catch (e) {
            logger.warn(`[API] Invalid parameters for read-only call: ${e.message}`);
            return res.status(400).json({ error: `Invalid parameters: ${e.message}` });
        }
    }
    const code = getContractCode(address);
    if (!code) {
        return res.status(404).json({ error: "Contract not found at this address." });
    }
    const currentContractStorage = getContractStorage(address);
    const tempBlock = {
        index: getBlockchain().length,
        previousHash: getBlockchain().length > 0 ? getBlockchain()[getBlockchain().length - 1].hash : "0".repeat(64),
        timestamp: Date.now(),
        data: [],
        hash: "0".repeat(64),
        proposer: "0x" + "0".repeat(40),
        proposerPublicKey: "0".repeat(64),
        signature: "0".repeat(128),
        shardId: 0,
    };
    const tempTransaction = {
        type: TxType.CALL,
        from: "0x" + "0".repeat(40),
        to: address,
        amount: 0,
        fee: 0,
        nonce: 0,
        timestamp: Date.now(),
        data: { method, params },
        signature: "",
        publicKey: "",
    };
    try {
        const executionResult = executeContract(code, tempTransaction, tempBlock, currentContractStorage, true);
        if (!executionResult.success) {
            return res.status(400).json({ error: `Contract method execution failed: ${executionResult.error}` });
        }
        res.json({ success: true, logs: executionResult.logs, returnValue: executionResult.returnValue });
    }
    catch (err) {
        logger.error(`[API] Read-only contract call failed: ${err.message || err}`);
        res.status(500).json({ error: "Internal server error during contract execution." });
    }
});
app.post('/unjail', async (req, res) => {
    try {
        const { address } = unjailSchema.parse(req.body);
        const success = unjailValidator(address);
        if (success) {
            logger.info(`[API] Unjail request successful for ${address.slice(0, 10)}...`);
            res.json({ success: true, message: "Validator unjailed successfully." });
        }
        else {
            logger.warn(`[API] Unjail request failed for ${address.slice(0, 10)}...`);
            res.status(400).json({ success: false, error: "Failed to unjail validator. Check node logs for details." });
        }
    }
    catch (err) {
        if (err instanceof ZodError) {
            const zodError = err;
            logger.warn(`[API] /unjail validation error: ${zodError.issues.map((e) => e.message).join(', ')}`);
            return res.status(400).json({ error: "Validation failed", details: zodError.issues });
        }
        const error = err instanceof Error ? err.message : String(err);
        logger.error(`[API] /unjail failed: ${error}`);
        res.status(500).json({ error: "Internal server error." });
    }
});
app.get('/peers', (req, res) => {
    res.json({ peers: getPeers() });
});
app.get('/blocks/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    const chain = getBlockchain();
    if (isNaN(index) || index < 0 || index >= chain.length) {
        return res.status(400).json({ error: "Invalid block index." });
    }
    res.json(chain[index]);
});
app.listen(PORT, () => logger.info(`🚀 Node running at http://localhost:${PORT}`));
// A small, harmless task to keep the event loop busy
setInterval(() => { }, 10000);
