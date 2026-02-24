# 📘 Aetherium Nova v2 - User Guide

Welcome to **Aetherium Nova v2**, a fully functional, "real-life" blockchain implementation built with Node.js, TypeScript, LevelDB, and WebSockets.

This guide will help you set up, run, and interact with your blockchain node and explorer.

---

## 🚀 1. Installation

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

### Setup Steps
1.  **Clone the Repository** (if you haven't already):
    ```bash
    git clone https://github.com/your-repo/aetherium-nova-v2.git
    cd aetherium-nova-v2
    ```

2.  **Install Application Dependencies**:
    ```bash
    npm install
    ```

3.  **Install Explorer Dependencies**:
    ```bash
    cd aetherium-nova-explorer
    npm install
    cd ..
    ```

4.  **(Optional) Build the Project**:
    Compiles TypeScript to JavaScript for both backend and frontend. Not
    required for development since `npm start` and `npm run dev` compile on the
    fly.
    ```bash
    npm run build
    ```

5.  **Run the Test Suite** (highly recommended before you start):
    ```bash
    npm test           # runs backend + explorer tests
    ```
    This checks that the core functionality is working and that the explorer
    frontend compiles properly.

---

## 🖥️ 2. Running the Blockchain Node

The "Node" is the heart of the blockchain. It manages the ledger, validates transactions, and connects to peers.

### Start the Node
In your terminal, run:
```bash
# make sure API key is set before starting
# the node enforces this and will exit if it's missing
export API_KEY="replace-with-a-secure-secret"    # Unix/macOS
$env:API_KEY = "replace-with-a-secure-secret"     # PowerShell

npm start
```
*   **Output**: Logs will show the node initializing, connecting to LevelDB, and
    binding to the HTTP API (default `3002`) and P2P port defined in
    `network.config.json`.
*   **Security**:
    * The node uses `helmet` HTTP headers and a strict CORS policy. You can
      override the allowed origin via `CORS_ORIGIN` env var (defaults to the
      local explorer address).
    * API requests must include the header `x-api-key: <your key>`.
*   **Database**: Ledger and state are persisted under `data/chain-db`. Do not
    delete or modify this folder unless you intend to reset the chain.

Because the node is a standalone process, you can run multiple nodes on
different ports (set `PORT` and `P2P_PORT` env vars) to form a network.

---

## 🛠️ 3. Using the Command-Line Interface (CLI)

The CLI allows you to interact with the blockchain manually—create wallets, send transactions, and mine blocks.

**Open a new terminal window** (keep the node running in the first one) and navigate to the project root.

### Common Commands

#### 👛 Wallet Management
*   **Create a new wallet**:
    ```bash
    npm run cli -- wallet create-wallet
    ```
    *   *Save the output!* It provides your Public Key, Address, and Private Key.

*   **List local wallets**:
    ```bash
    npm run cli -- wallet list-wallets
    ```

#### ⛏️ Mining
*   **Mine a new block**:
    Processes transactions from the mempool and submits a block proposal to the
    local node. The node awards the configured base reward plus collected fees
    to the miner address.
    ```bash
    # must point to an existing wallet that can be decrypted
    export MINER_ADDRESS="0x..."          # Unix/macOS
    $env:MINER_ADDRESS = "0x..."          # PowerShell

    # if your wallet file is encrypted, also provide the passphrase
    export WALLET_PASSWORD="your-passphrase"

    npm run cli -- mine
    ```
    *   The CLI will automatically compute the block hash and sign it.  The
        node itself will re‑create the reward transaction using the block
        timestamp – this ensures all nodes agree on the block hash.
    *   The reward transaction is **not** sent over the wire; the node generates
        it independently to prevent tampering.  You will simply receive the
        reward in your miner address once the block is accepted.

#### 💸 Transactions
*   **Send Funds**:
    ```bash
    npm run cli -- transaction send --from <YOUR_PRIVATE_KEY> --to <RECIPIENT_ADDR> --amount 10
    ```

*   **Check Balance**:
    ```bash
    npm run cli -- query balance <ADDRESS>
    ```

---

## 🌐 4. Using the Block Explorer

The **Aetherium Nova Explorer** provides a beautiful visual interface to view the blockchain state.

1.  **Navigate to the Explorer directory**:
    ```bash
    cd aetherium-nova-explorer
    ```

2.  **Start the Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Visit the URL shown in the terminal (usually `http://localhost:5173`).

### Features
*   **Dashboard**: View real-time Block Height, TPS, and Active Nodes.
*   **Recent Blocks**: See the latest blocks mined by the network. Clicking a
    block shows its transactions.
*   **Wallet Page**: Create a web-wallet, view balances, and send transactions
    directly from the UI. The private key is **never persisted to localStorage**
    after our recent security updates; you must back it up elsewhere.
*   **Network Stats**: Visualize the health of the P2P network (peer count,
    sync status, message latency).
*   **Staking Page**: Stake your tokens, view validators, and claim rewards.
*   **CLI Interface**: A built‑in command page for running the same commands you
    would in the terminal.

The explorer polls the node every few seconds, so what you see in the UI is the
actual chain state of whatever node you’ve configured via
`VITE_API_URL` (defaults to `http://localhost:3002`).

---

### Additional Environment Variables
Add any of the following to `.env.local` in the explorer directory to
customize behaviour:
```env
VITE_API_URL=http://localhost:3002    # node to query
VITE_WHITELIST_ORIGIN=http://localhost:5173
```

These are injected at build time and are not part of the public Git repo.

---

## 🔧 5. Advanced Configuration

### Environment Variables (`.env`)
Create a `.env` file in the root directory to customize your node:

```env
# Network Configuration
PORT=3002               # HTTP API Port
P2P_PORT=6001           # WebSocket P2P Port

# Initial Configuration
GENESIS_TIMESTAMP=1672531200000
```

### Resetting the Blockchain
If you want to start fresh (delete all blocks and data):
**Windows (PowerShell)**:
```powershell
Remove-Item -Recurse -Force .aetherium-nova-db
```
**Mac/Linux**:
```bash
rm -rf .aetherium-nova-db
```
*Restart the node afterwards to generate a new Genesis block.*

---

## ❓ Troubleshooting

*   **Error: `EADDRINUSE`**: The port is already taken. This usually means an instance of the node is already running. Check your terminals and close any duplicates.
*   **Explorer says "Syncing..." forever**: Ensure the backend node is running (`npm start`) and accessible at `http://localhost:3002`.
*   **Database Lock Error**: LevelDB can only be opened by *one process* at a time. Ensure you don't have two `npm start` processes running simultaneously.
