// src/node.ts
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import * as client from 'prom-client';
import cors from 'cors';
import helmet from 'helmet';
import { z, ZodError, ZodIssue } from 'zod';
import { type Transaction, getTransactionId, TxType } from './Transaction.js';
import { getBlockchain, getChainLength, proposeBlock, calculateBlockHash, replaceChain, type Block, getLatestBlock } from './chain.js';
import { getBalance, setBalance, getNonceForAddress, getContractCode, getContractStorage, saveLedgerToDisk, loadLedgerFromDisk } from './ledger.js';
import { Mempool } from './pool.js';
import { p2p } from './services/p2p.js';
import { NETWORK_CONFIG, GENESIS_CONFIG } from './config.js';
import { getLogger } from './logger.js';
import { createWallet, signTransaction, verifySignature } from './wallet.js';
import { chooseNextBlockProposer, unjailValidator, getValidator, getAllValidators, type Validator, loadStakingLedgerFromDisk } from './staking.js';
import { apiKeyAuth } from './auth.js';
import { executeContract } from './vm.js';
import { commitmentPool, COMMIT_DELAY_BLOCKS, computeCommitment } from './commitment_pool.js';

const logger = getLogger();

// Catch and log uncaught exceptions — then exit (Node is in undefined state after this)
process.on('uncaughtException', (err) => {
  logger.error(`[Node] Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`[Node] Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

const app = express();
app.use(helmet());                                              // Security headers (X-Content-Type-Options, CSP, HSTS, etc.)
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' })); // Restrict CORS
app.use(bodyParser.json({ limit: '100kb' }));                  // Limit payload size
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
const blocksMined = new client.Counter({ name: 'aetherium_nova_blocks_mined_total', help: 'Total blocks mined' });
const mempoolGauge = new client.Gauge({ name: 'aetherium_nova_mempool_size', help: 'Current mempool size' });
// Gossip handled by P2P service


// Ledger loaded asynchronously below


const mempool = new Mempool();
setInterval(() => mempoolGauge.set(mempool.getPool().length), 5000);

(async () => {
  try {
    await loadLedgerFromDisk();
    await loadStakingLedgerFromDisk();

    // Initialize P2P
    const p2pPort = parseInt(process.env.P2P_PORT || "6001");
    p2p.setMempool(mempool);
    p2p.listen(p2pPort);

    // Connect to seed peers (from config)
    NETWORK_CONFIG.seedPeers.forEach((peer: string) => {
      if (peer.trim().length > 0) p2p.connectToPeer(peer);
    });

    // Connect to extra peers supplied via INITIAL_PEERS env var (comma-separated)
    const initialPeers = process.env.INITIAL_PEERS;
    if (initialPeers) {
      initialPeers.split(',').forEach((peer: string) => {
        const trimmed = peer.trim();
        if (trimmed.length > 0) p2p.connectToPeer(trimmed);
      });
    }

  } catch (err: any) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[Node] Initialization failed: ${error}`);
  }
})();

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Saving state and shutting down...');
  await saveLedgerToDisk();
  process.exit(0);
});

const publicTransactionSchema = z.object({
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
  hash: z.string().length(64),
});

const blockTransactionSchema = z.object({
  type: z.nativeEnum(TxType),
  from: z.string(), // Allow 'coinbase'
  to: z.string().startsWith('0x').length(42),
  amount: z.number().nonnegative(),
  fee: z.number().nonnegative(),
  nonce: z.number().int(), // allow -1 for coinbase
  timestamp: z.number().int().nonnegative(),
  data: z.any().optional(),
  signature: z.string(),
  publicKey: z.string(),
  hash: z.string().length(64),
});

const blockReceiveSchema = z.object({
  index: z.number().int().nonnegative(),
  previousHash: z.string().length(64),
  timestamp: z.number().int().nonnegative(),
  data: z.array(blockTransactionSchema),
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
  const chain = getBlockchain();
  const now = Date.now();
  const windowMs = 60 * 1000;
  let txCount = 0;
  let earliest = now;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].timestamp < now - windowMs) break;
    txCount += chain[i].data.length;
    earliest = chain[i].timestamp;
  }
  const elapsed = Math.max(1, (now - earliest) / 1000);
  const tps = txCount > 0 ? Math.round((txCount / elapsed) * 100) / 100 : 0;
  res.json({
    height: getChainLength(),
    peers: p2p.getPeers().length,
    mempool: mempool.getPool().length,
    tps,
  });
});

app.get('/chain', (req: Request, res: Response) => {
  const chain = getBlockchain();
  if (req.query.page !== undefined || req.query.limit !== undefined) {
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const reversed = [...chain].reverse();
    const slice = reversed.slice(page * limit, page * limit + limit);
    return res.json({ version: '2.0', chain: slice, total: chain.length, page, limit, pages: Math.ceil(chain.length / limit) });
  }
  res.json({ version: "2.0", chain });
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
    const tx: Transaction = publicTransactionSchema.parse(req.body);

    const result = mempool.addToPool(tx);
    if (result.success) {
      transactionsProcessed.inc();
      mempoolGauge.set(mempool.getPool().length);
      p2p.broadcastTransaction(tx);
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

// ── Encrypted Mempool: commit phase ──────────────────────────────────────────
const commitSchema = z.object({
  commitment: z.string().regex(/^[0-9a-f]{64}$/i, 'Must be a 64-char lowercase hex SHA3-256 hash'),
  from: z.string().startsWith('0x').length(42),
  fee: z.number().nonnegative(),
});

app.post('/mempool/commit', (req: Request, res: Response) => {
  try {
    const { commitment, from, fee } = commitSchema.parse(req.body);
    const currentBlock = Math.max(0, getChainLength() - 1);
    const result = commitmentPool.commit(commitment, from, fee, currentBlock);
    if (!result.ok) {
      return res.status(400).json({ error: result.message });
    }
    logger.info(`[API] Commitment ${commitment.slice(0, 12)}... accepted from ${from.slice(0, 10)}...`);
    return res.status(202).json({
      ok: true,
      commitment,
      revealAfterBlock: result.revealAfterBlock,
      expiresAtBlock: result.expiresAtBlock,
      message: `Commitment accepted. You may reveal after block ${result.revealAfterBlock}.`,
    });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (err as ZodError).issues });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Encrypted Mempool: reveal phase ──────────────────────────────────────────
const revealBodySchema = z.object({
  transaction: z.record(z.unknown()),
  secret: z.string().regex(/^[0-9a-f]{1,128}$/i, 'Secret must be a hex string'),
});

app.post('/mempool/reveal/:commitment', (req: Request, res: Response) => {
  try {
    const commitment = req.params.commitment ?? '';
    if (!/^[0-9a-f]{64}$/i.test(commitment)) {
      return res.status(400).json({ error: 'Invalid commitment format.' });
    }
    const entry = commitmentPool.getEntry(commitment);
    if (!entry) return res.status(404).json({ error: 'Commitment not found.' });
    if (entry.revealed) return res.status(400).json({ error: 'Commitment already revealed.' });

    const currentBlock = Math.max(0, getChainLength() - 1);
    if (currentBlock < entry.submittedBlock + COMMIT_DELAY_BLOCKS) {
      return res.status(400).json({
        error: `Too early to reveal. Current block: ${currentBlock}. Reveal allowed after block: ${entry.submittedBlock + COMMIT_DELAY_BLOCKS}.`,
      });
    }

    const { transaction: rawTx, secret } = revealBodySchema.parse(req.body);
    const txJson = JSON.stringify(rawTx);

    if (!commitmentPool.verify(commitment, txJson, secret)) {
      logger.warn(`[API] Reveal failed: commitment hash mismatch for ${commitment.slice(0, 12)}...`);
      return res.status(400).json({ error: 'Commitment hash mismatch — invalid pre-image.' });
    }

    // Validate and add the revealed transaction to the regular mempool
    const tx: Transaction = publicTransactionSchema.parse(rawTx);
    const result = mempool.addToPool(tx);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    commitmentPool.markRevealed(commitment);
    transactionsProcessed.inc();
    mempoolGauge.set(mempool.getPool().length);
    p2p.broadcastTransaction(tx);

    const txId = getTransactionId(tx);
    logger.info(`[API] Commitment ${commitment.slice(0, 12)}... revealed. TxID: ${txId.slice(0, 12)}...`);
    return res.status(202).json({ ok: true, message: 'Transaction revealed and queued.', txId });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (err as ZodError).issues });
    }
    const error = err instanceof Error ? err.message : String(err);
    logger.error(`[API] /mempool/reveal failed: ${error}`);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Encrypted Mempool: status ─────────────────────────────────────────────────
app.get('/mempool/commits', (req: Request, res: Response) => {
  res.json({
    pending: commitmentPool.pendingCount(),
    total: commitmentPool.totalCount(),
  });
});

app.post('/proposeBlock', async (req: Request, res: Response) => {
  try {
    logger.info(`[API] Received a block proposal request with body: ${JSON.stringify(req.body, null, 2)}`);
    const block = blockReceiveSchema.parse(req.body);

    // Prune stale commitments before processing the block
    commitmentPool.pruneExpired(Math.max(0, getChainLength() - 1));

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
      block.timestamp,
      mempool
    );

    if (newBlock) {
      blocksMined.inc();
      mempoolGauge.set(mempool.getPool().length);
      p2p.broadcastBlock(newBlock);
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
    p2p.connectToPeer(url);
    res.json({ message: `Peer ${url} added.` });
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

    const replaced = await replaceChain(newChainCandidate, mempool);

    if (replaced) {
      p2p.broadcastBlock(block);
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
  const chainLen = getChainLength();
  const latestBlock = getLatestBlock();
  const tempBlock: Block = {
    index: chainLen,
    previousHash: chainLen > 0 ? latestBlock.hash : "0".repeat(64),
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
    hash: ''
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

// ─── Validators ──────────────────────────────────────────────────────────────
app.get('/validators', (req: Request, res: Response) => {
  const vs = getAllValidators();
  const result = Array.from(vs.values()).map(v => ({
    address: v.address,
    publicKey: v.publicKey,
    totalStake: v.totalStake,
    jailed: v.jailed,
    slashCount: v.slashCount ?? 0,
    delegatorCount: v.delegators.size,
    lastProposedBlock: v.lastProposedBlock ?? null,
  }));
  res.json({ validators: result });
});

// ─── Universal search ─────────────────────────────────────────────────────────
app.get('/search', (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (!q) return res.status(400).json({ error: 'Query required' });

  // Block height
  const height = parseInt(q);
  if (!isNaN(height) && String(height) === q && height >= 0 && height < getChainLength()) {
    return res.json({ type: 'block', data: getBlockchain()[height] });
  }

  // Ethereum-style address
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
    return res.json({ type: 'address', data: { address: q, balance: getBalance(q), nonce: getNonceForAddress(q) } });
  }

  // TX hash (64 hex chars)
  if (/^[0-9a-fA-F]{64}$/.test(q)) {
    const chain = getBlockchain();
    for (let i = chain.length - 1; i >= 0; i--) {
      const tx = chain[i].data.find(t => t.hash === q);
      if (tx) return res.json({ type: 'transaction', data: { tx, blockIndex: chain[i].index, confirmed: true } });
    }
    const pending = mempool.getPool().find(t => t.hash === q);
    if (pending) return res.json({ type: 'transaction', data: { tx: pending, blockIndex: null, confirmed: false } });
  }

  res.status(404).json({ error: 'Not found', query: q });
});

// ─── Testnet faucet ───────────────────────────────────────────────────────────
const faucetCooldowns = new Map<string, number>();
const FAUCET_AMOUNT = 100;
const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000;

app.post('/faucet', async (req: Request, res: Response) => {
  const { address } = req.body || {};
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Valid 0x address required' });
  }
  const last = faucetCooldowns.get(address);
  if (last && Date.now() - last < FAUCET_COOLDOWN_MS) {
    const remainHours = Math.ceil((FAUCET_COOLDOWN_MS - (Date.now() - last)) / 3_600_000);
    return res.status(429).json({ error: `Cooldown active. Try again in ${remainHours}h.` });
  }
  setBalance(address, getBalance(address) + FAUCET_AMOUNT);
  faucetCooldowns.set(address, Date.now());
  await saveLedgerToDisk();
  logger.info(`[Faucet] Sent ${FAUCET_AMOUNT} AN to ${address}`);
  res.json({ success: true, message: `${FAUCET_AMOUNT} AN sent to ${address}`, newBalance: getBalance(address) });
});

app.get('/peers', (req: Request, res: Response) => {
  res.json({ peers: p2p.getPeers() });
});

app.get('/blocks/:index', (req: Request, res: Response) => {
  const index = parseInt(req.params.index, 10);
  if (isNaN(index) || index < 0 || index >= getChainLength()) {
    return res.status(400).json({ error: "Invalid block index." });
  }
  res.json(getBlockchain()[index]);
});

// --- P2P ---
// P2P Sync handled in initialization


app.listen(PORT, () => {
  logger.info(`🚀 Node running at http://localhost:${PORT}`);
});

// A small, harmless task to keep the event loop busy
setInterval(() => { }, 10000);