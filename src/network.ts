import axios from 'axios';
import { getBlockchain, replaceChain, type Block } from './chain.js';
import { type Transaction, getTransactionId } from './Transaction.js';
import { NETWORK_CONFIG } from './config.js';
import logger from './logger.js';

let peers = new Set<string>(NETWORK_CONFIG.seedPeers);
const seenMessages = new Set<string>();

function addToSeen(id: string) {
  seenMessages.add(id);
  if (seenMessages.size > 10000) {
    const oldest = seenMessages.values().next().value;
    if (oldest !== undefined) {
      seenMessages.delete(oldest);
    }
  }
}

export function getPeers(): string[] { return Array.from(peers); }

export async function addPeer(url: string, propagate: boolean = true): Promise<void> {
  const selfUrl = `http://localhost:${process.env.PORT || NETWORK_CONFIG.defaultPort}`;
  if (peers.has(url) || url === selfUrl) {
      return;
  }
  logger.info(`[Network] Adding new peer: ${url}`);
  peers.add(url);
  
  if (propagate) {
      try {
          await axios.post(`${url}/addPeer`, { url: selfUrl }, { timeout: 5000 });
          logger.info(`[Network] Announced self to new peer ${url}.`);
      } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          logger.warn(`[Network] Failed to announce self to new peer ${url}: ${error}`);
      }
  }
}

export async function connectToPeer(url: string): Promise<void> {
  await addPeer(url, true);
  await syncWithPeers();
}

async function broadcast(endpoint: string, data: any, originPeer?: string): Promise<void> {
  const hash = data.hash ?? getTransactionId(data);
  if (!hash) {
      logger.warn(`[Network] Attempted to broadcast data without a valid hash/ID: ${JSON.stringify(data)}`);
      return;
  }
  if (seenMessages.has(hash)) return;
  addToSeen(hash);
  
  const promises = Array.from(peers)
    .filter(peer => peer !== originPeer)
    .map(peerUrl => axios.post(`${peerUrl}${endpoint}`, data, { timeout: 5000 })
        .then(() => logger.debug(`[Network] Broadcasted to ${peerUrl}${endpoint} (ID: ${hash.slice(0, 10)}...)`))
        .catch((err: unknown) => {
            const error = err instanceof Error ? err.message : String(err);
            logger.warn(`[Network] Failed to broadcast to ${peerUrl}${endpoint} (ID: ${hash.slice(0, 10)}...): ${error}.`);
        })
    );
  await Promise.all(promises);
}

export const broadcastBlock = (block: Block, originPeer?: string) => broadcast('/block', block, originPeer);
export const broadcastTransaction = (tx: Transaction, originPeer?: string) => broadcast('/transaction', tx, originPeer);

export async function gossipPeers(): Promise<void> {
  const currentPeers = getPeers();
  if (currentPeers.length === 0) {
    logger.debug('[Network] No peers to gossip with.');
    return;
  }

  const randomPeer = currentPeers[Math.floor(Math.random() * currentPeers.length)];

  try {
    const response = await axios.get(`${randomPeer}/peers`, { timeout: 5000 });
    if (response.data && Array.isArray(response.data.peers)) {
      const discoveredPeers: string[] = response.data.peers;
      for (const discoveredPeer of discoveredPeers) {
        await addPeer(discoveredPeer, false);
      }
      logger.debug(`[Network] Discovered ${discoveredPeers.length} peers via gossip from ${randomPeer}.`);
    } else {
      logger.warn(`[Network] Invalid gossip response from ${randomPeer}.`);
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn(`[Network] Failed to gossip with ${randomPeer}: ${error}.`);
  }
}

export async function syncWithPeers(): Promise<void> {
  logger.info('[Network] Starting sync with peers...');
  const currentPeers = getPeers();
  if (currentPeers.length === 0) {
      logger.info('[Network] No peers to sync with.');
      return;
  }

  for (const peer of currentPeers) {
    try {
      logger.debug(`[Network] Requesting chain from ${peer}/chain...`);
      const chainResponse = await axios.get(`${peer}/chain`, { timeout: 15000 });
      if (chainResponse.data && Array.isArray(chainResponse.data.chain)) {
        if (chainResponse.data.chain.length > getBlockchain().length) {
            logger.info(`[Network] Found longer chain from ${peer}. Attempting replaceChain.`);
            if (!(await replaceChain(chainResponse.data.chain))) {
                logger.warn(`[Network] Failed to replace chain from ${peer}. Chain was invalid or not longer.`);
            }
        } else {
            logger.debug(`[Network] Chain from ${peer} is not longer than local chain.`);
        }
      } else {
          logger.warn(`[Network] Invalid chain response from ${peer}.`);
      }

      logger.debug(`[Network] Requesting peers from ${peer}/peers...`);
      const peersResponse = await axios.get(`${peer}/peers`, { timeout: 5000 });
      if (peersResponse.data && Array.isArray(peersResponse.data.peers)) {
          const discoveredPeers: string[] = peersResponse.data.peers;
          for (const discoveredPeer of discoveredPeers) {
              await addPeer(discoveredPeer, false);
          }
          logger.debug(`[Network] Discovered ${discoveredPeers.length} peers from ${peer}.`);
      } else {
          logger.warn(`[Network] Invalid peers response from ${peer}.`);
      }

    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      logger.warn(`[Network] Failed to sync with peer ${peer}: ${error}.`);
      peers.delete(peer);
    }
  }
  logger.info('[Network] Peer synchronization complete.');
}