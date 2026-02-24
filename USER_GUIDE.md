# 📘 Aetherium Nova — User Guide

Welcome to **Aetherium Nova**, a production-grade Layer-1 blockchain built with Node.js 22, TypeScript, LevelDB, and WebSockets.

This guide covers everything from first-run to advanced validator configuration, Docker deployment, smart contract development, and TLS-encrypted peer networking.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Running a Node](#2-running-a-blockchain-node)
3. [Docker Deployment](#3-docker-deployment-recommended-for-validators)
4. [Command-Line Interface](#4-command-line-interface-cli)
5. [Block Explorer](#5-block-explorer)
6. [REST API Reference](#6-rest-api-reference)
7. [Smart Contracts](#7-smart-contracts)
8. [Staking & Validators](#8-staking--validators)
9. [P2P Networking & TLS](#9-p2p-networking--tls)
10. [Advanced Configuration](#10-advanced-configuration)
11. [Resetting the Chain](#11-resetting-the-chain)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Installation

### Prerequisites
- **Node.js** v20 or higher (`node --version` to check)
- **npm** v9 or higher
- Git

### Steps

```bash
# 1. Clone
git clone https://github.com/ashrafmusa/Aetherium_Nova_v2.git
cd Aetherium_Nova_v2

# 2. Install backend dependencies
npm install

# 3. Install explorer dependencies
cd aetherium-nova-explorer && npm install && cd ..

# 4. Build (compiles TypeScript + bundles smart contract base + contracts)
npm run build

# 5. Verify everything works
npm test
```

Expected test output: **9 tests, 9 passed**.

---

## 2. Running a Blockchain Node

### Environment setup

Create a `.env` file in the project root (copy from `.env.example`):

```env
API_KEY=replace-with-a-strong-random-secret
PORT=3001          # HTTP REST API port
P2P_PORT=6001      # WebSocket P2P port
MINER_ADDRESS=0x.. # Optional — validator address for block rewards
PEERS=ws://seed.aetherium.io:6001  # Optional — comma-separated peer URLs
```

> **`API_KEY` is required.** The node will refuse to start without it.

### Start the node

```bash
# Unix / macOS
API_KEY=your-secret npm start

# PowerShell
$env:API_KEY="your-secret"; npm start
```

The node will:
- Bind the REST API at `http://localhost:3001`
- Open the P2P WebSocket listener on port `6001`
- Load the existing chain from `data/chain-db` (LevelDB), or create the genesis block on first run
- Connect to any peers listed in `PEERS` or `network.config.json`

Logs appear in the terminal and are written to `logs/`.

### Security notes
- All REST API requests require the header `x-api-key: <your secret>`.
- The API uses Helmet security headers, CORS protection, and `express-rate-limit`.
- P2P connections are SSRF-protected — private IP ranges are automatically blocked.

---

## 3. Docker Deployment (recommended for validators)

Docker gives you an isolated, reproducible node with persistent storage — the recommended way to run a validator.

### Quick start

```bash
# 1. Copy the example env file and fill in your API key (at minimum)
cp .env.example .env
# Edit .env — set API_KEY to a strong random string

# 2. Build the image and start a node
docker compose up -d

# 3. Check it is healthy
docker compose ps
curl -H "x-api-key: <your key>" http://localhost:3001/status
```

### Ports

| Host port | Container | Purpose |
|---|---|---|
| `3001` | `3001` | REST API |
| `6001` | `6001` | P2P WebSocket |

Override ports in `.env`:
```env
API_PORT=3001
P2P_PORT=6001
```

### Persistent volumes

All chain data, wallets, and logs are stored in named Docker volumes — they survive container restarts and image updates.

| Volume | Content |
|---|---|
| `aetherium-chain` | LevelDB chain database (`data/`) |
| `aetherium-wallets` | Encrypted wallet files (`wallets/`) |
| `aetherium-logs` | Node logs (`logs/`) |

### Two-node local peer simulation

```bash
docker compose --profile peers up -d
```

This starts a second node on ports `3002`/`6002` that automatically peers with the first node — useful for testing block propagation and consensus locally.

### Enabling TLS (wss://)

Mount your PEM certificate and key into the container, then set these vars in `.env`:

```env
P2P_TLS_CERT=/app/certs/cert.pem
P2P_TLS_KEY=/app/certs/key.pem
```

And add a volume mount in `docker-compose.yml`:
```yaml
volumes:
  - ./certs:/app/certs:ro
```

When both vars are set the P2P listener automatically upgrades to `wss://`.

### Updating

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

---

## 4. Command-Line Interface (CLI)

Keep the node running in one terminal, then open a second terminal for CLI commands.

### Wallet

```bash
# Create a new encrypted wallet
node dist/cli.js wallet create

# List all saved local wallets
node dist/cli.js wallet list

# Show the balance of any address
node dist/cli.js query balance --address 0x...
```

> Wallet files are saved as encrypted JSON under `wallets/`. Back them up — losing the file or passphrase means losing access to the funds.

### Sending transactions

```bash
node dist/cli.js transaction send \
  --from <YOUR_WALLET_ADDRESS> \
  --to <RECIPIENT_ADDRESS> \
  --amount 50
```

You will be prompted for your wallet passphrase.

### Mining / Block proposal

```bash
# Set your miner address and start proposing blocks
MINER_ADDRESS=0x... node dist/cli.js mine
```

What happens:
1. The CLI fetches pending transactions from the mempool.
2. Builds a block, hashes it (including `chainId` to prevent cross-network replay), and signs it with your validator key.
3. Submits it to the local node via `POST /mine`.
4. The node independently appends the reward transaction — you cannot forge a larger reward.

### Staking

```bash
# Stake tokens to become a validator (minimum stake defined in genesis.config.json)
node dist/cli.js staking stake --amount 10000 --validator 0x...

# Unstake
node dist/cli.js staking unstake --amount 5000 --validator 0x...

# Claim accumulated rewards
node dist/cli.js staking claim-rewards --validator 0x...
```

---

## 5. Block Explorer

The explorer is a React 18 + Vite + Tailwind web app that connects to the running node.

### Start for development

```bash
cd aetherium-nova-explorer

# Create local env (only needed once)
echo "VITE_API_URL=http://localhost:3001" > .env.local
echo "VITE_API_KEY=your-secret"          >> .env.local

npm run dev
```

Open `http://localhost:5173`.

### Build for production

```bash
npm run build   # output goes to aetherium-nova-explorer/dist/
```

Serve `dist/` with any static host (Nginx, GitHub Pages, Netlify, etc.).

### Explorer features

| Page | What it shows |
|---|---|
| **Dashboard** | Live block height, TPS (calculated from last 60 s), peer count, mempool depth |
| **Network Explorer** | Recent blocks with transaction counts; universal search (address / tx hash / block height) |
| **Wallet** | Create / import wallet; live balance; send transactions; **Testnet Faucet** (claim 100 AN every 24 h) |
| **Staking** | Validators list with stake, jailed status, delegator count; stake / unstake / claim-rewards UI |
| **CLI Page** | Quick-reference for all CLI commands |

### Universal search

The search bar in the Network Explorer accepts:
- A `0x`-prefixed **address** (40 hex chars) → shows balance + transaction history
- A 64-hex-char **transaction hash** → shows transaction details
- An **integer** block height → shows that block

### Testnet faucet

On the Wallet page, click **"Get 100 Test AN"**. The faucet enforces a 24-hour cooldown per address server-side.

---

## 6. REST API Reference

All endpoints require the header `x-api-key: <your secret>`.

### Node status

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/status` | Node height, peer count, mempool size, **live TPS** |
| `GET` | `/metrics` | Prometheus metrics (scrape with Grafana/Prometheus) |

### Chain

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/chain` | Full blockchain (most-recent-first) |
| `GET` | `/chain?page=1&limit=20` | Paginated blocks |
| `GET` | `/mempool` | Pending transactions |

### Accounts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/balance/:address` | Address balance and current nonce |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/transaction` | Submit a signed transaction |
| `POST` | `/mine` | Propose a new block (requires validator key) |

### Validators & Staking

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/validators` | All registered validators with stake, jailed status, delegator count |

### Search & Utilities

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/search?q=<query>` | Resolve address / tx hash / block height |
| `POST` | `/faucet` | Claim 100 testnet AN (body: `{ "address": "0x..." }`) |

### Example: submit a transaction

```bash
curl -X POST http://localhost:3001/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret" \
  -d '{
    "type": "TRANSFER",
    "from": "0xabc...",
    "to":   "0xdef...",
    "amount": 100,
    "fee": 0.01,
    "nonce": 3,
    "timestamp": 1700000000000,
    "publicKey": "04abc...",
    "signature": "3045..."
  }'
```

---

## 7. Smart Contracts

Aetherium Nova runs smart contracts in a **`node:vm` sandbox** — fully isolated from the host process with gas metering and a strict timeout.

### How contracts work

1. You write a class that **extends `SmartContract`** from `src/SmartContract.ts`.
2. The build pipeline (`esbuild-contracts.mjs`) bundles it into a self-contained IIFE and sets `global.ContractClass`.
3. When a `DEPLOY` transaction is processed the bundle is stored on-chain.
4. When a `CALL` transaction is processed the VM:
   - Runs the IIFE to register `ContractClass`
   - Instantiates the class (constructor runs)
   - Calls `tx.data.method(...tx.data.params)`
   - Writes the updated storage back to the ledger (or rolls back on failure)

### Writing a contract

Place your file in `src/contracts/`. Example — a simple counter:

```typescript
// src/contracts/MyCounter.ts
import { SmartContract, type ContractContext } from '../SmartContract.js';

export class MyCounter extends SmartContract {
  constructor(context: ContractContext) {
    super(context);
    if (this.storage.get('count') === undefined) {
      this.storage.set('count', 0);
      this.emitEvent('CounterInitialized', 0);
    }
  }

  increment(): void {
    const count = (this.storage.get('count') as number) + 1;
    this.storage.set('count', count);
    this.log(`Counter is now ${count}`);
    this.emitEvent('Incremented', count, this.transaction.sender);
  }

  getCount(): number {
    return this.storage.get('count') as number;
  }
}
```

### Available APIs inside a contract

| API | Description |
|---|---|
| `this.storage.get(key)` | Read a value from contract storage |
| `this.storage.set(key, value)` | Write a value (costs gas) |
| `this.blockchain.getBalance(address)` | Read any address balance |
| `this.blockchain.transfer(recipient, amount)` | Send AN from this contract |
| `this.blockchain.callContract(addr, method, params)` | Inter-contract call |
| `this.blockchain.getHeight()` | Current block height |
| `this.log(...args)` | Write to execution logs |
| `this.emitEvent(name, ...args)` | Emit a named event |
| `this.transaction` | `sender`, `value`, `fee`, `data`, `to` |
| `this.block` | `height`, `timestamp`, `proposer` |

### Gas costs (from `genesis.config.json`)

| Operation | Gas |
|---|---|
| Base execution | 100 |
| Storage read | 10 |
| Storage write | 100 |
| Log entry | 5 |
| Inter-contract call overhead | 500 |
| Transfer by contract | 200 |
| Per bytecode byte | 0.05 |

### Build & deploy workflow

```bash
# 1. Write your contract in src/contracts/MyContract.ts

# 2. Build (compiles + bundles the contract)
npm run build

# 3. Deploy via CLI (reads the compiled bundle from dist/contracts/)
node dist/cli.js transaction deploy --contract MyContract --amount 0

# 4. Call a method
node dist/cli.js transaction call \
  --to 0x<contract-address> \
  --method increment \
  --params '[]'
```

---

## 8. Staking & Validators

Aetherium Nova uses **Proof-of-Stake & Utility (PoSU)** consensus.

### Becoming a validator

1. Create a wallet with enough AN to meet `minStake` (default: `1000 AN`).
2. Submit a `STAKE` transaction pointing `to` your own address.
3. Your address appears in `/validators` once the block is confirmed.

### Validator lifecycle

| State | Meaning |
|---|---|
| Active | Eligible to propose blocks; earns base reward + transaction fees |
| Jailed | Slashed for bad behaviour (double-propose, invalid block). Cannot propose. |
| Unjailed | Released after `unjailPeriodMs` (default: 10 s testnet / 24 h mainnet) |

### Reward distribution

Each block the proposer earns:
```
reward = baseReward (50 AN) + sum(transaction fees in block)
```

A share of that reward (`delegatorSharePercentage = 20%`) is split proportionally among delegators. Accumulated rewards are held in the staking ledger until `CLAIM_REWARDS` is submitted.

### Slashing

A validator is slashed `slashPercentage` (5%) of their total stake for:
- Including an invalid transaction in a block
- Proposing a block with a duplicate transaction
- Reward inflation (overstating block reward)

---

## 9. P2P Networking & TLS

### How peers connect

On startup the node:
1. Reads `seedPeers` from `network.config.json` and the `PEERS` env var.
2. Opens a WebSocket server on `P2P_PORT` (default `6001`).
3. Performs a handshake with each peer, syncs the latest block, then keeps the connection alive for block/transaction broadcasting.

Peer discovery is recursive — connected peers share their own peer lists.

### Enabling encrypted connections (wss://)

Set these two environment variables to the file-system paths of a PEM TLS certificate and its private key:

```env
P2P_TLS_CERT=/etc/ssl/aetherium/cert.pem
P2P_TLS_KEY=/etc/ssl/aetherium/key.pem
```

When both are present, the P2P listener starts as `wss://`. Peers connecting to this node must use `wss://host:6001` — confirm you update your `PEERS` / seed lists accordingly.

> In development (no TLS vars set) the node falls back to plain `ws://` and logs a warning.

### Self-signed certificate (development TLS)

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=aetherium-dev"

P2P_TLS_CERT=./cert.pem P2P_TLS_KEY=./key.pem npm start
```

### Chain ID & replay protection

Every block hash includes `chainId` (set in `genesis.config.json`, default `2` for testnet). This means:
- A block signed on testnet is **cryptographically invalid** on mainnet (chain ID `1`) and vice-versa.
- Transactions cannot be replayed across networks.

When launching mainnet, set `chainId: 1` in `genesis.config.json` **before** creating the genesis block — changing it after breaks the chain.

---

## 10. Advanced Configuration

### `genesis.config.json`

| Field | Default | Description |
|---|---|---|
| `chainId` | `2` | Network identifier (1 = mainnet, 2 = testnet) |
| `totalSupply` | `1 000 000 000` | Total AN supply minted at genesis |
| `baseReward` | `50` | Block reward in AN |
| `minStake` | `1 000` | Minimum AN to register as validator |
| `minFee` | `0.001` | Minimum transaction fee |
| `maxTransactionsPerBlock` | `100` | Hard cap on txs per block |
| `vmExecutionTimeoutMs` | `5 000` | Max milliseconds a contract may run |
| `vmMemoryLimitMB` | `128` | Soft memory limit passed to sandbox |
| `slashPercentage` | `0.05` | Fraction of stake slashed on violation |
| `epochLength` | `100` | Blocks per validator-set rotation epoch |
| `unstakePeriodMs` | `604 800 000` | 7-day unstaking lock |
| `delegatorSharePercentage` | `0.2` | 20% of block reward goes to delegators |

### `network.config.json`

```json
{
  "defaultPort": 3001,
  "seedPeers": ["ws://seed1.example.com:6001"],
  "pruneMempoolInterval": 60000
}
```

Override `seedPeers` at runtime with the `PEERS` env var without editing the file.

### Full environment variable reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_KEY` | **Yes** | — | Secret for `x-api-key` header |
| `PORT` | No | `3001` | HTTP API port |
| `P2P_PORT` | No | `6001` | P2P WebSocket port |
| `MINER_ADDRESS` | No | — | Validator address for rewards |
| `PEERS` | No | — | Comma-separated peer `ws://` or `wss://` URLs |
| `P2P_TLS_CERT` | No | — | Path to PEM TLS certificate |
| `P2P_TLS_KEY` | No | — | Path to PEM private key |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `LOG_LEVEL` | No | `info` | Winston log level |

---

## 11. Resetting the Chain

> ⚠️ This permanently deletes all blocks, balances, and staking state.

```bash
# PowerShell
Remove-Item -Recurse -Force data\chain-db
Remove-Item -Recurse -Force wallets

# Unix / macOS
rm -rf data/chain-db wallets
```

Restart the node — a fresh genesis block will be created automatically.

For Docker:
```bash
docker compose down -v   # -v removes all named volumes
docker compose up -d
```

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `API_KEY environment variable is not set` | Missing env var | Set `API_KEY` before starting |
| `EADDRINUSE` on port 3001 or 6001 | Another node instance is running | Kill the old process: `lsof -ti:3001` / `Stop-Process` |
| Explorer shows "Connecting…" forever | Node not reachable | Check `VITE_API_URL` in `.env.local` matches your node URL; confirm node is running |
| `LevelDB LOCK: already held by process` | Two node processes sharing the same `data/` | Run only one node per `data/` directory |
| Block rejected: `invalid signature` | Chain ID mismatch between nodes | Ensure all nodes use the same `chainId` in `genesis.config.json` |
| Contract call returns `ContractClass not found` | Contract was not deployed or bundle is stale | Re-run `npm run build` then re-deploy the contract |
| P2P connections refused | TLS cert/key mismatch or expired cert | Regenerate self-signed cert; update `P2P_TLS_CERT`/`P2P_TLS_KEY` paths |
| Tests fail with `Cannot find module jest-environment-jsdom` | Explorer `node_modules` not installed | Run `cd aetherium-nova-explorer && npm install` |
