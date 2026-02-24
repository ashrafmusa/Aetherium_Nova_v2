
import https from 'node:https';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { getLogger } from '../logger.js';
import { getBlockchain, getLatestBlock, replaceChain, appendBlock, Block } from '../chain.js';
import { Transaction, getTransactionId } from '../Transaction.js';
import { Mempool } from '../pool.js';
import { NETWORK_CONFIG } from '../config.js';

/**
 * Load TLS credentials from env-var file paths, if both are set.
 * Set P2P_TLS_CERT and P2P_TLS_KEY to the paths of your PEM-encoded cert
 * and private key respectively to enable encrypted wss:// connections.
 */
function loadTlsCredentials(): { cert: Buffer; key: Buffer } | null {
  const certPath = process.env.P2P_TLS_CERT;
  const keyPath = process.env.P2P_TLS_KEY;
  if (!certPath || !keyPath) return null;
  try {
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    return { cert, key };
  } catch (err: any) {
    const logger = getLogger();
    logger.error(`[P2P] Failed to load TLS credentials: ${err.message}. Falling back to plaintext ws://.`);
    return null;
  }
}

const logger = getLogger();

// Private/reserved IP ranges that peers must not resolve to (SSRF protection)
const BLOCKED_IP_PATTERNS = [
  /^127\./,                      // loopback
  /^10\./,                       // RFC 1918
  /^192\.168\./,                 // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,  // RFC 1918
  /^169\.254\./,                 // link-local
  /^::1$/,                       // IPv6 loopback
  /^fd/,                         // IPv6 unique-local
  /^localhost$/i,
];

function isBlockedPeer(peerUrl: string): boolean {
  // Allow private/loopback peers in dev mode (P2P_ALLOW_PRIVATE=true)
  if (process.env.P2P_ALLOW_PRIVATE === 'true') return false;
  try {
    const { hostname } = new URL(peerUrl);
    return BLOCKED_IP_PATTERNS.some(re => re.test(hostname));
  } catch {
    return true; // Invalid URL — block it
  }
}

// Message Types
enum MessageType {
  HANDSHAKE = 'HANDSHAKE',
  QUERY_LATEST = 'QUERY_LATEST',
  QUERY_ALL = 'QUERY_ALL',
  RESPONSE_BLOCKCHAIN = 'RESPONSE_BLOCKCHAIN',
  BROADCAST_TRANSACTION = 'BROADCAST_TRANSACTION',
  BROADCAST_BLOCK = 'BROADCAST_BLOCK',
  QUERY_PEERS = 'QUERY_PEERS',
  RESPONSE_PEERS = 'RESPONSE_PEERS'
}

interface Message {
  type: MessageType;
  data: any;
}

/** Per-connection session state for ML-KEM-768 encrypted channels */
interface SessionState {
  ready: boolean;
  key?: Buffer;           // 32-byte AES-256-GCM session key
  kxSecretKey?: Uint8Array; // server side only — discarded after handshake
}

export class P2PService {
  private static instance: P2PService;
  private sockets: WebSocket[] = [];
  private peers: Set<string> = new Set();
  private server: WebSocketServer | null = null;
  private mempool: Mempool | null = null;
  /** Tracks encryption state per WebSocket connection */
  private sessions = new Map<WebSocket, SessionState>();

  private constructor() { }

  public static getInstance(): P2PService {
    if (!P2PService.instance) {
      P2PService.instance = new P2PService();
    }
    return P2PService.instance;
  }

  public setMempool(mempool: Mempool) {
    this.mempool = mempool;
  }

  public listen(port: number) {
    const tls = loadTlsCredentials();

    if (tls) {
      // ── Encrypted mode (wss://) ──────────────────────────────────────────
      const httpsServer = https.createServer({ cert: tls.cert, key: tls.key });
      this.server = new WebSocketServer({ server: httpsServer });
      httpsServer.listen(port, () => {
        logger.info(`[P2P] Listening for encrypted P2P connections (wss://) on port ${port}`);
      });
    } else {
      // ── Plaintext mode (ws://) ──────────────────────────────────────────
      logger.warn('[P2P] TLS not configured (P2P_TLS_CERT / P2P_TLS_KEY not set). Using unencrypted ws://. Set these env vars for production.');
      this.server = new WebSocketServer({ port });
      logger.info(`[P2P] Listening for P2P connections (ws://) on port ${port}`);
    }

    this.server.on('connection', (ws: WebSocket, req) => {
      const ip = req.socket.remoteAddress;
      logger.info(`[P2P] Incoming connection from ${ip}`);
      // ── ML-KEM-768 key exchange (server initiates) ──────────────────────
      const { publicKey, secretKey } = ml_kem768.keygen();
      this.sessions.set(ws, { ready: false, kxSecretKey: secretKey });
      this.initMessageHandler(ws);
      this.initErrorHandler(ws);
      ws.send(JSON.stringify({
        type: 'KX_INIT',
        publicKey: Buffer.from(publicKey).toString('hex'),
        algo: 'ML-KEM-768',
      }));
      // completeConnection() is called inside handleKxResponse after KX completes
    });
  }

  public connectToPeer(peer: string) {
    if (this.peers.has(peer)) return;

    if (isBlockedPeer(peer)) {
      logger.warn(`[P2P] Refused connection to blocked/private peer: ${peer}`);
      return;
    }

    logger.info(`[P2P] Connecting to peer: ${peer}`);
    const ws = new WebSocket(peer);

    ws.on('open', () => {
      this.sessions.set(ws, { ready: false });
      this.peers.add(peer); // optimistic add
      this.initMessageHandler(ws);
      this.initErrorHandler(ws);
      // Waits for KX_INIT from server — handled inside initMessageHandler
    });

    ws.on('error', (err) => {
      logger.warn(`[P2P] Connection failed to ${peer}: ${err.message}`);
      this.peers.delete(peer);
    });
  }

  public getPeers(): string[] {
    return Array.from(this.peers);
  }

  public broadcastTransaction(tx: Transaction) {
    this.broadcast({
      type: MessageType.BROADCAST_TRANSACTION,
      data: tx
    });
  }

  public broadcastBlock(block: Block) {
    this.broadcast({
      type: MessageType.BROADCAST_BLOCK,
      data: block
    });
  }

  public syncChains() {
    this.broadcast({
      type: MessageType.QUERY_LATEST,
      data: null
    });
  }

  /** Called after ML-KEM-768 handshake is complete on both sides. */
  private completeConnection(ws: WebSocket): void {
    if (!this.sockets.includes(ws)) this.sockets.push(ws);
    // Kick off blockchain sync over the now-encrypted channel
    this.write(ws, { type: MessageType.QUERY_LATEST, data: null });
    setTimeout(() => {
      this.write(ws, { type: MessageType.QUERY_PEERS, data: null });
    }, 1000);
  }

  private initMessageHandler(ws: WebSocket) {
    ws.on('message', async (data: Buffer) => {
      try {
        const raw = JSON.parse(data.toString());
        // ── KX phase: always plaintext, handled before decrypt ────────────
        if (raw.type === 'KX_INIT') { await this.handleKxInit(ws, raw); return; }
        if (raw.type === 'KX_RESPONSE') { await this.handleKxResponse(ws, raw); return; }
        // ── Decrypt if the session key is established ─────────────────────
        const session = this.sessions.get(ws);
        let message: Message;
        if (session?.ready && session.key && raw.type === 'ENCRYPTED') {
          message = this.decryptMsg(session.key, raw);
        } else {
          message = raw as Message;
        }
        await this.handleMessage(ws, message);
      } catch (err) {
        logger.error(`[P2P] Failed to parse message: ${err}`);
      }
    });
  }

  private initErrorHandler(ws: WebSocket) {
    const closeConnection = (ws: WebSocket) => {
      logger.info(`[P2P] Connection closed.`);
      this.sessions.delete(ws);          // free session key material
      const idx = this.sockets.indexOf(ws);
      if (idx !== -1) this.sockets.splice(idx, 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
  }

  private async handleMessage(ws: WebSocket, message: Message) {
    switch (message.type) {
      case MessageType.QUERY_LATEST:
        this.write(ws, {
          type: MessageType.RESPONSE_BLOCKCHAIN,
          data: [getLatestBlock()]
        });
        break;

      case MessageType.QUERY_ALL:
        this.write(ws, {
          type: MessageType.RESPONSE_BLOCKCHAIN,
          data: getBlockchain()
        });
        break;

      case MessageType.RESPONSE_BLOCKCHAIN:
        await this.handleBlockchainResponse(message.data);
        break;

      case MessageType.BROADCAST_TRANSACTION:
        if (this.mempool) {
          const tx: Transaction = message.data;
          // optimistic check
          if (!this.mempool.contains(getTransactionId(tx))) {
            const result = this.mempool.addToPool(tx);
            if (result.success) {
              logger.info(`[P2P] Received new transaction ${getTransactionId(tx)} via propogation.`);
              this.broadcastTransaction(tx);
            }
          }
        }
        break;

      case MessageType.BROADCAST_BLOCK:
        const receivedBlock: Block = message.data;
        const latestBlock = getLatestBlock();

        if (receivedBlock.index > latestBlock.index) {
          logger.info(`[P2P] Received block ${receivedBlock.index}. Checking validity...`);
          if (receivedBlock.previousHash === latestBlock.hash) {
            // Direct single-block append (replaceChain requires longer chain, can't use it here)
            if (await appendBlock(receivedBlock, this.mempool)) {
              logger.info('[P2P] Block appended to local chain directly.');
              this.broadcastBlock(receivedBlock);
            } else {
              // Validation failed — query full chain to resync
              this.write(ws, { type: MessageType.QUERY_ALL, data: null });
            }
          } else {
            // Gap detected, query full chain
            this.write(ws, { type: MessageType.QUERY_ALL, data: null });
          }
        }
        break;

      case MessageType.QUERY_PEERS:
        this.write(ws, {
          type: MessageType.RESPONSE_PEERS,
          data: Array.from(this.peers)
        });
        break;

      case MessageType.RESPONSE_PEERS:
        const receivedPeers: string[] = message.data;
        receivedPeers.forEach(peer => {
          this.connectToPeer(peer);
        });
        break;
    }
  }

  private async handleBlockchainResponse(receivedChain: Block[]) {
    if (receivedChain.length === 0) return;

    const latestBlockReceived = receivedChain[receivedChain.length - 1];
    const latestBlockHeld = getLatestBlock();

    if (latestBlockReceived.index > latestBlockHeld.index) {
      logger.info(`[P2P] Blockchain response has longer chain (Local: ${latestBlockHeld.index}, Remote: ${latestBlockReceived.index})`);
      if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
        // One block ahead
        logger.info('[P2P] We are one block behind. Appending...');
        if (await appendBlock(latestBlockReceived, this.mempool)) {
          this.broadcastBlock(latestBlockReceived);
        } else {
          // Append failed, fall back to full sync
          this.broadcast({ type: MessageType.QUERY_ALL, data: null });
        }
      } else if (receivedChain.length === 1) {
        // We got only one block but we need more
        logger.info('[P2P] We need more context. Querying full chain.');
        this.broadcast({ type: MessageType.QUERY_ALL, data: null });
      } else {
        // Received full chain
        logger.info('[P2P] Received full chain. Attempting replacement.');
        await replaceChain(receivedChain, this.mempool);
      }
    } else {
      logger.info('[P2P] Received chain is not longer than local chain.');
    }
  }

  private write(ws: WebSocket, message: Message): void {
    const session = this.sessions.get(ws);
    if (session?.ready && session.key) {
      ws.send(this.encryptMsg(session.key, message));
    } else {
      ws.send(JSON.stringify(message));
    }
  }

  // ── AES-256-GCM helpers ─────────────────────────────────────────────────

  private encryptMsg(key: Buffer, message: Message): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(message), 'utf8');
    const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      type: 'ENCRYPTED',
      iv: iv.toString('hex'),
      data: data.toString('hex'),
      tag: tag.toString('hex'),
    });
  }

  private decryptMsg(key: Buffer, raw: { iv: string; data: string; tag: string }): Message {
    const iv = Buffer.from(raw.iv, 'hex');
    const tag = Buffer.from(raw.tag, 'hex');
    const ciphertext = Buffer.from(raw.data, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as Message;
  }

  // ── ML-KEM-768 key exchange ─────────────────────────────────────────────

  /** Client side: server sent its ML-KEM-768 public key → encapsulate → send ciphertext */
  private async handleKxInit(ws: WebSocket, raw: { publicKey: string; algo: string }): Promise<void> {
    try {
      const serverPubKey = Buffer.from(raw.publicKey, 'hex');
      const { sharedSecret, cipherText } = ml_kem768.encapsulate(serverPubKey);
      const sessionKey = Buffer.from(sharedSecret);
      this.sessions.set(ws, { ready: true, key: sessionKey });
      ws.send(JSON.stringify({ type: 'KX_RESPONSE', ciphertext: Buffer.from(cipherText).toString('hex') }));
      logger.info('[P2P] ✓ ML-KEM-768 handshake complete (client). Post-quantum encrypted channel active.');
      this.completeConnection(ws);
    } catch (err: any) {
      logger.error(`[P2P] KX_INIT handling failed: ${err.message}`);
      ws.close();
    }
  }

  /** Server side: client sent encapsulated ciphertext → decapsulate → derive session key */
  private async handleKxResponse(ws: WebSocket, raw: { ciphertext: string }): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session?.kxSecretKey) {
      logger.warn('[P2P] KX_RESPONSE received with no pending KX state. Closing.');
      ws.close();
      return;
    }
    try {
      const ciphertext = Buffer.from(raw.ciphertext, 'hex');
      const sharedSecret = ml_kem768.decapsulate(ciphertext, session.kxSecretKey);
      const sessionKey = Buffer.from(sharedSecret);
      // Store final session state — kxSecretKey intentionally not kept
      this.sessions.set(ws, { ready: true, key: sessionKey });
      logger.info('[P2P] ✓ ML-KEM-768 handshake complete (server). Post-quantum encrypted channel active.');
      this.completeConnection(ws);
    } catch (err: any) {
      logger.error(`[P2P] KX_RESPONSE handling failed: ${err.message}`);
      ws.close();
    }
  }

  private broadcast(message: Message) {
    this.sockets.forEach(socket => this.write(socket, message));
  }
}

export const p2p = P2PService.getInstance();
