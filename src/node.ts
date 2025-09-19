// src/node.ts (Updated with Debugging)
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import * as client from 'prom-client';
import cors from 'cors';
import { z, ZodError, ZodIssue } from 'zod';
import { type Transaction, getTransactionId, TxType } from './Transaction.js';
import { getBlockchain, proposeBlock, calculateBlockHash, replaceChain, type Block, getLatestBlock } from './chain.js';
import { getBalance, getNonceForAddress, getContractCode, getContractStorage, saveLedgerToDisk } from './ledger.js';
import mempool from './pool.js';
import { broadcastBlock, broadcastTransaction, getPeers, connectToPeer, syncWithPeers, gossipPeers } from './network.js';
import { NETWORK_CONFIG, GENESIS_CONFIG } from './config.js';
import logger from './logger.js';
import { createWallet, signTransaction, verifySignature, decryptPrivateKey, encryptPrivateKey } from './wallet.js';
import { chooseNextBlockProposer, unjailValidator, getValidator, type Validator } from './staking.js';
import { apiKeyAuth } from './auth.js';
import { executeContract } from './vm.js';
import fs from 'fs';
import path from 'path';

// Catch and log any uncaught exceptions before the process exits
process.on('uncaughtException', (err) => {
  logger.error(`[Node] Uncaught Exception: ${err.message}`, { stack: err.stack });
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
  } catch (err: any) {
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

const addPeerSchema = z.object({
  url: z.string().url({ message: "Invalid peer URL format." }),
});

const unjailSchema = z.object({
  address: z.string().startsWith('0x').length(42, { message: "Address must be 42 characters long and start with 0x" }),
});

app.post('/create-wallet', (req: Request, res: Response) => {
  try {
    const wallet = createWallet();
    logger.info(`[API] Created new temporary wallet: ${wallet.address}`);
    res.json({ publicKey: wallet.publicKey, address: wallet.address, message: "Wallet created. Private key not exposed via API." });
  } catch (err: any) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] Failed to create wallet: ${error}`);
    res.status(500).json({ error: "Failed to create wallet." });
  }
});

app.get('/balance/:address', (req: Request, res: Response) => {
    const { address = "" } = req.params;
    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
      return res.status(400).json({ error: "Invalid address format. Must be 42 characters and start with '0x'." });
    }
    const balance = getBalance(address);
    res.json({ address, balance });
});

app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', client.register.contentType).end(await client.register.metrics());
  } catch (err: any) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] /metrics failed: ${error}`);
    res.status(500).json({ error: "Failed to retrieve metrics." });
  }
});

app.get('/status', (req: Request, res: Response) => {
  res.json({
    height: getBlockchain().length,
    peers: getPeers().length,
    mempool: mempool.getPool().length
  });
});

app.get('/chain', (req: Request, res: Response) => {
  res.json({ version: "2.0", chain: getBlockchain() });
});

app.get('/latestBlock', (req: Request, res: Response) => {
  res.json(getLatestBlock());
});

app.get('/mempool', (req: Request, res: Response) => {
  res.json({ pool: mempool.getPool() });
});

app.get('/nonce/:address', (req: Request, res: Response) => {
  const { address = "" } = req.params;
  if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
    return res.status(400).json({ error: "Invalid address format. Must be 42 characters and start with '0x'." });
  }
  res.json({ address, nonce: getNonceForAddress(address) });
});

app.get('/contract/:address', (req: Request, res: Response) => {
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

app.post('/transaction', (req: Request, res: Response) => {
  try {
    const tx: Transaction = rawTransactionSchema.parse(req.body);

    const result = mempool.addToPool(tx);
    if (result.success) {
      transactionsProcessed.inc();
      mempoolGauge.set(mempool.getPool().length);
      broadcastTransaction(tx);
      if (tx.type === TxType.DEPLOY) {
        return res.status(202).json({ message: "Deploy transaction accepted", contractAddress: tx.to, txId: getTransactionId(tx) });
      }
      res.status(202).json({ message: "Transaction accepted.", txId: getTransactionId(tx) });
    } else {
      logger.warn(`[API] Transaction rejected: ${result.message}`);
      res.status(400).json({ error: result.message });
    }
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const zodError = err as ZodError;
      logger.warn(`[API] /transaction validation error: ${zodError.issues.map((e: ZodIssue) => e.message).join(', ')}`);
      return res.status(400).json({ error: "Validation failed", details: zodError.issues });
    }
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] /transaction failed: ${error}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post('/proposeBlock', async (req: Request, res: Response) => {
  try {
    logger.info(`[API] Received a block proposal request with body: ${JSON.stringify(req.body, null, 2)}`);
    const block = blockReceiveSchema.parse(req.body);

    const proposerValidator = getValidator(block.proposer);
    if (!proposerValidator || !proposerValidator.publicKey) {
      logger.error(`[API] Block proposal failed: Proposer ${block.proposer.slice(0, 10)}... not a valid validator.`);
      return res.status(400).json({ error: "Proposer not a valid validator." });
    }

    const lastBlock = getLatestBlock();
    if (lastBlock.hash !== block.previousHash) {
      logger.error(`[API] Proposed block rejected: previousHash mismatch.`);
      return res.status(400).json({ error: "Previous block hash mismatch." });
    }

    const expectedProposer = chooseNextBlockProposer(lastBlock.hash);
    if (expectedProposer !== block.proposer) {
        logger.warn(`[API] Block proposal rejected: ${block.proposer.slice(0, 10)}... is not the expected proposer. Expected: ${expectedProposer?.slice(0, 10)}...`);
        return res.status(403).json({ error: "Not the current block proposer." });
    }

    const newBlock = await proposeBlock(
      block.data,
      block.proposer,
      block.proposerPublicKey,
      block.signature,
      block.timestamp
    );

    if (newBlock) {
      blocksMined.inc();
      mempoolGauge.set(mempool.getPool().length);
      broadcastBlock(newBlock);
      logger.info(`[API] Block ${newBlock.index} proposed successfully.`);
      res.json({ message: "Block proposed.", block: newBlock });
    } else {
      logger.error(`[API] Block proposal failed for ${block.proposer}.`);
      res.status(500).json({ error: "Block proposal failed, potentially due to invalid transactions or internal error." });
    }
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const zodError = err as ZodError;
      logger.warn(`[API] /proposeBlock validation error: ${zodError.issues.map((e: ZodIssue) => e.message).join(', ')}`);
      return res.status(400).json({ error: "Validation failed", details: zodError.issues });
    }
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] /proposeBlock failed: ${error}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post('/addPeer', async (req: Request, res: Response) => {
    try {
      const { url } = addPeerSchema.parse(req.body);
      await connectToPeer(url);
      res.json({ message: `Peer ${url} added and sync initiated.` });
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const zodError = err as ZodError;
        logger.warn(`[API] /addPeer validation error: ${zodError.issues.map((e: ZodIssue) => e.message).join(', ')}`);
        return res.status(400).json({ error: "Validation failed", details: zodError.issues });
    }
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] /addPeer failed: ${error}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post('/block', async (req: Request, res: Response) => {
  try {
    const block: Block = blockReceiveSchema.parse(req.body);

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
    } else {
      res.status(200).json({ message: "Block received but not accepted (not longer/more difficulty chain or invalid)." });
    }
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const zodError = err as ZodError;
      logger.warn(`[API] /block validation error: ${zodError.issues.map((e: ZodIssue) => e.message).join(', ')}`);
      return res.status(400).json({ error: "Validation failed", details: zodError.issues });
    }
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] /block failed: ${error}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get('/contract/:address/call/:method', (req: Request, res: Response) => {
  const { address = "" } = req.params;
  const method = req.params.method;
  let params: any[] = [];

  if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
    return res.status(400).json({ error: "Invalid contract address format." });
  }
  if (!method || typeof method !== 'string') {
    return res.status(400).json({ error: "Method name is required." });
  }

  if (req.query.args) {
    try {
      params = JSON.parse(req.query.args as string);
      if (!Array.isArray(params)) {
        throw new Error("Parameters must be a JSON array.");
      }
    } catch (e: any) {
      logger.warn(`[API] Invalid parameters for read-only call: ${e.message}`);
      return res.status(400).json({ error: `Invalid parameters: ${e.message}` });
    }
  }

  const code = getContractCode(address);
  if (!code) {
    return res.status(404).json({ error: "Contract not found at this address." });
  }

  const currentContractStorage = getContractStorage(address);
  const tempBlock: Block = {
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
  const tempTransaction: Transaction = {
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
  } catch (err: any) {
    logger.error(`[API] Read-only contract call failed: ${err.message || err}`);
    res.status(500).json({ error: "Internal server error during contract execution." });
  }
});

app.post('/unjail', async (req: Request, res: Response) => {
  try {
    const { address } = unjailSchema.parse(req.body);

    const success = unjailValidator(address);

    if (success) {
      logger.info(`[API] Unjail request successful for ${address.slice(0, 10)}...`);
      res.json({ success: true, message: "Validator unjailed successfully." });
    } else {
      logger.warn(`[API] Unjail request failed for ${address.slice(0, 10)}...`);
      res.status(400).json({ success: false, error: "Failed to unjail validator. Check node logs for details." });
    }
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const zodError = err as ZodError;
      logger.warn(`[API] /unjail validation error: ${zodError.issues.map((e: ZodIssue) => e.message).join(', ')}`);
      return res.status(400).json({ error: "Validation failed", details: zodError.issues });
    }
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] /unjail failed: ${error}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get('/peers', (req: Request, res: Response) => {
  res.json({ peers: getPeers() });
});

app.get('/blocks/:index', (req: Request, res: Response) => {
    const index = parseInt(req.params.index, 10);
    const chain = getBlockchain();
    if(isNaN(index) || index < 0 || index >= chain.length) {
      return res.status(400).json({ error: "Invalid block index." });
    }
    res.json(chain[index]);
});

app.listen(PORT, () => logger.info(`🚀 Node running at http://localhost:${PORT}`));

// A small, harmless task to keep the event loop busy
setInterval(() => {}, 10000);