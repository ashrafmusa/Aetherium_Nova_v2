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
node dist/cli.js wallet create

# Check balance
node dist/cli.js query balance --address 0x...

# Send tokens
node dist/cli.js transaction send --to 0x... --amount 100

# Stake
node dist/cli.js staking stake --amount 1000

# Mine a block
MINER_ADDRESS=0x... node dist/cli.js mine
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
