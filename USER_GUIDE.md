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

4.  **Build the Project**:
    Compiles TypeScript to JavaScript for both backend and frontend.
    ```bash
    npm run build
    ```

---

## 🖥️ 2. Running the Blockchain Node

The "Node" is the heart of the blockchain. It manages the ledger, validates transactions, and connects to peers.

### Start the Node
In your terminal, run:
```bash
npm start
```
*   **Output**: You should see logs indicating the node has started, loaded the database (LevelDB), and is listening on a P2P port and API port (default `3002` or `3000`).
*   **Database**: Data is stored in the `.aetherium-nova-db` folder (hidden). This persists across restarts.

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
    Mines pending transactions from the mempool into a new block.
    ```bash
    npm run cli -- mine
    ```
    *   *Note*: You need a wallet address to receive the mining reward. Configure this in your environment or CLI prompts (if applicable).

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
*   **Recent Blocks**: See the latest blocks mined by the network.
*   **Wallet Page**: Create a web-wallet, view balances, and send transactions directly from the UI.
*   **Network Stats**: Visualize the health of the P2P network.

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
