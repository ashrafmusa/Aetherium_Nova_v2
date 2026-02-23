
import { WebSocket, WebSocketServer } from 'ws';
import { getLogger } from '../logger.js';
import { getBlockchain, getLatestBlock, replaceChain, appendBlock, Block } from '../chain.js';
import { Transaction, getTransactionId } from '../Transaction.js';
import { Mempool } from '../pool.js';
import { NETWORK_CONFIG } from '../config.js';

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

export class P2PService {
  private static instance: P2PService;
  private sockets: WebSocket[] = [];
  private peers: Set<string> = new Set();
  private server: WebSocketServer | null = null;
  private mempool: Mempool | null = null;

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
    this.server = new WebSocketServer({ port });
    logger.info(`[P2P] Listening for P2P connections on port ${port}`);

    this.server.on('connection', (ws: WebSocket, req) => {
      const ip = req.socket.remoteAddress;
      logger.info(`[P2P] Incoming connection from ${ip}`);
      this.initConnection(ws);
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
      this.initConnection(ws);
      this.peers.add(peer); // optimistic add
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

  private initConnection(ws: WebSocket) {
    this.sockets.push(ws);
    this.initMessageHandler(ws);
    this.initErrorHandler(ws);

    // Initial Handshake
    this.write(ws, { type: MessageType.QUERY_LATEST, data: null });

    // Also ask for peers
    setTimeout(() => {
      this.write(ws, { type: MessageType.QUERY_PEERS, data: null });
    }, 1000);
  }

  private initMessageHandler(ws: WebSocket) {
    ws.on('message', async (data: string) => {
      try {
        const message: Message = JSON.parse(data);
        await this.handleMessage(ws, message);
      } catch (err) {
        logger.error(`[P2P] Failed to parse message: ${err}`);
      }
    });
  }

  private initErrorHandler(ws: WebSocket) {
    const closeConnection = (ws: WebSocket) => {
      logger.info(`[P2P] Connection closed.`);
      this.sockets.splice(this.sockets.indexOf(ws), 1);
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

  private write(ws: WebSocket, message: Message) {
    ws.send(JSON.stringify(message));
  }

  private broadcast(message: Message) {
    this.sockets.forEach(socket => this.write(socket, message));
  }
}

export const p2p = P2PService.getInstance();
