# Aetherium Nova

[![CI](https://github.com/ashrafmusa/Aetherium_Nova_v2/actions/workflows/ci.yml/badge.svg)](https://github.com/ashrafmusa/Aetherium_Nova_v2/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ashrafmusa/Aetherium_Nova_v2/blob/main/.github/CONTRIBUTING.md)

**A next-generation Layer-1 blockchain built for the post-quantum era.**

Aetherium Nova is a fully operational blockchain network featuring a custom **Proof-of-Stake & Utility (PoSU)** consensus mechanism, a persistent ledger, a smart contract virtual machine, a P2P networking layer, and a production-grade web explorer — all built from the ground up in TypeScript.

> 🌐 [Explorer](https://ashrafmusa.github.io/Aetherium_Nova_v2) | 📄 Whitepaper | 💬 Discord | 🐦 Twitter

---

## ✨ Why Aetherium Nova?

| Feature | Detail |
|---|---|
| **PoSU Consensus** | Hybrid Proof-of-Stake + Utility rewards — validators earn by both staking and contributing network utility |
| **secp256k1 Cryptography** | Industry-standard elliptic curve signing, compatible with Bitcoin and Ethereum key formats |
| **Persistent LevelDB Ledger** | Full state snapshot and recovery — nodes can restart and resync without reprocessing the entire chain |
| **Smart Contract VM** | Custom sandboxed virtual machine for deterministic on-chain computation |
| **P2P Networking** | WebSocket-based peer discovery, block propagation, and mempool sync |
| **Production Explorer** | Full-featured React + Vite web explorer with wallet management, staking UI, and block/TX search |
| **REST API** | Authenticated JSON API (rate-limited, helmet-secured, prometheus metrics) for wallets and dApps |

---

## 🏗️ Architecture

```
aetherium-nova-v2/
├── src/
│   ├── node.ts          # Express HTTP server + REST API entry point
│   ├── chain.ts         # Block structure, validation, and chain management
│   ├── ledger.ts        # Global state: balances, nonces, contract storage
│   ├── staking.ts       # PoSU validator registry, rewards, jailing
│   ├── pool.ts          # Mempool — unconfirmed transaction queue
│   ├── wallet.ts        # Key generation, signing, address derivation
│   ├── vm.ts            # Smart contract execution sandbox
│   ├── Transaction.ts   # Transaction types: TRANSFER, STAKE, UNSTAKE, CONTRACT
│   ├── auth.ts          # API key authentication middleware
│   ├── config.ts        # Network + genesis configuration
│   └── services/
│       ├── p2p.ts       # WebSocket P2P peer management
│       └── database.ts  # LevelDB persistence layer
└── aetherium-nova-explorer/
    └── ...              # React 18 + Vite + Tailwind web explorer
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### 1. Clone & Install
```bash
git clone https://github.com/ashrafmusa/Aetherium_Nova_v2.git
cd Aetherium_Nova_v2
npm install
```

### 2. Build
```bash
npm run build
```

### 3. Run a Node
```bash
API_KEY=your-secret-key node dist/node.js
```

Node starts at `http://localhost:3001` with P2P on port `6001`.

### 4. Run the Explorer
```bash
cd aetherium-nova-explorer
npm install
# Set env vars
echo "VITE_API_URL=http://localhost:3001" > .env.local
echo "VITE_API_KEY=your-secret-key" >> .env.local
npx vite
```

Explorer available at `http://localhost:5173`.

---

## 🔌 REST API

All endpoints require the `x-api-key` header.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/status` | Node height, peer count, mempool size |
| GET | `/chain` | Full blockchain |
| GET | `/mempool` | Pending transactions |
| GET | `/balance/:address` | Address balance and nonce |
| POST | `/transaction` | Submit a signed transaction |
| POST | `/mine` | Propose a new block |
| GET | `/metrics` | Prometheus metrics |

---

## ⛏️ CLI

```bash
# Create a wallet
node dist/cli.js create-wallet

# Check balance
node dist/cli.js get-balance 0x<address>

# Check nonce
node dist/cli.js get-nonce 0x<address>

# Send tokens  (WALLET_PASSWORD env var unlocks the sender)
WALLET_PASSWORD="..." node dist/cli.js transfer <from> <to> <amount> <fee>

# Stake as a validator (min 1000 AN)
WALLET_PASSWORD="..." node dist/cli.js stake <from> <validatorAddress> <amount> <fee>

# Unstake
WALLET_PASSWORD="..." node dist/cli.js unstake <from> <validatorAddress> <amount> <fee>

# Claim staking rewards
WALLET_PASSWORD="..." node dist/cli.js claim-rewards <from> <validatorAddress> <fee>

# Deploy a smart contract
WALLET_PASSWORD="..." node dist/cli.js deploy <from> <contractFile.ts> <fee>

# Call a contract (state-changing)
WALLET_PASSWORD="..." node dist/cli.js call-contract <from> <contractAddr> <method> <fee> [params...]

# Read a contract (read-only, no tx)
node dist/cli.js read-contract <contractAddr> <method> [params...]

# Mine a block
WALLET_PASSWORD="..." node dist/cli.js mine

# View block details
node dist/cli.js get-block <index>

# Get full node status
node dist/cli.js status
```

---

---

## 🟢 Live Demo

The following output was captured from a **live running node** on a local chain (height 8, Chain ID 2).

### Node status
```
$ node dist/cli.js status
  Blockchain Height: 8
  Connected Peers:   0
  Mempool Size:      0
```

### Wallets
```
$ node dist/cli.js list-wallets
  - 0x249e54f4c7e421ec2728eb6d47dd5f01e3ca7e91
  - 0x53e5542df655861ba6795f1cca0d37ea13146b2a
  - 0x5449c1c0d82b61d2f1ba2958529dc92d5260a214
  - 0xd5ee6bc2c1afcbfaa68b3273caf9d4c17f4819e0
```

### Balances
```
$ node dist/cli.js get-balance 0xd5ee6bc2c1afcbfaa68b3273caf9d4c17f4819e0
  Balance: 635.15 AN   (miner — block rewards)

$ node dist/cli.js get-balance 0x5449c1c0d82b61d2f1ba2958529dc92d5260a214
  Balance: 999999994947998 AN   (primary vault)

$ node dist/cli.js get-balance 0x249e54f4c7e421ec2728eb6d47dd5f01e3ca7e91
  Balance: 51000 AN   (test recipient — received 50,000 AN transfer)
```

### Transfer (vault → test recipient)
```
$ WALLET_PASSWORD="..." node dist/cli.js transfer \
    0x5449c1c0d82b61d2f1ba2958529dc92d5260a214 \
    0x249e54f4c7e421ec2728eb6d47dd5f01e3ca7e91 50000 1

  ✓ Transfer transaction accepted. (TxID: b6d988b9b4...)
```

### Mine a block
```
$ WALLET_PASSWORD="..." node dist/cli.js mine

  Loading miner wallet (0xd5ee6bc2...)
  ✓ Wallet loaded.
  Fetching latest block and mempool...
  Found 1 pending transactions.
  Signing and sending block proposal to node...
  ✓ Block proposed: 9d1af16a54...
  🪙 Block Index: 6
```

### Stake as validator
```
$ WALLET_PASSWORD="..." node dist/cli.js stake \
    0x5449c1c0d82b61d2f1ba2958529dc92d5260a214 \
    0x5449c1c0d82b61d2f1ba2958529dc92d5260a214 1000 1

  ✓ Stake transaction accepted. (TxID: 57ec92a94a...)
```

### Block 7 (stake confirmation block)
```
$ node dist/cli.js get-block 7

  ✓ 🪙 Block 7 Details:
  Hash:          12fcb4e3bfe69742e67ba5de966208d8ca646e86f7cc6fa54caad16341cd1bb7
  Previous Hash: 9d1af16a54d3dc7f584006781fad95c53eb83404ef032d45a5ae9fad2bb1b677
  Timestamp:     2/24/2026, 7:58:56 PM
  Proposer:      0xd5ee6bc2c1afcbfaa68b3273caf9d4c17f4819e0
  Transactions:  2
    Tx 1: Type=STAKE,  From=0x5449c1c0..., To=0x5449c1c0..., Amount=1000, Fee=1
    Tx 2: Type=REWARD, From=coinbase...,   To=0xd5ee6bc2..., Amount=51,   Fee=0
```

### Nonces (replay-protection)
```
$ node dist/cli.js get-nonce 0xd5ee6bc2c1afcbfaa68b3273caf9d4c17f4819e0
  Nonce: 2

$ node dist/cli.js get-nonce 0x5449c1c0d82b61d2f1ba2958529dc92d5260a214
  Nonce: 2
```

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 22, TypeScript
- **Consensus**: Custom PoSU (Proof-of-Stake & Utility)
- **Crypto**: secp256k1 (elliptic), AES-256-GCM wallet encryption (PBKDF2-SHA512)
- **Storage**: LevelDB
- **API**: Express, Helmet, express-rate-limit, Prometheus
- **P2P**: WebSockets (ws)
- **Explorer**: React 18, Vite, Tailwind CSS

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push and open a PR

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE)
