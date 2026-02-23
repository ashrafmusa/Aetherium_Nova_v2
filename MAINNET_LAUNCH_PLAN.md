# 🚀 Aetherium Nova Mainnet Launch Roadmap

Transitioning from a local testnet to a public "Official" Mainnet requires improvements in Infrastructure, Security, and Governance. This roadmap outlines the critical steps.

## Phase 1: Hardening the Core (Technical Security)

1.  **Finalize Genesis Configuration** (`src/config.ts`)
    *   **Timestamp**: Set a future `GENESIS_TIMESTAMP` so all nodes start simultaneously.
    *   **Bootstrap Addresses**: Define the initial token distribution (Team, DAO, ICO, Community) in `genesis.config.json`.
    *   **Chain ID**: Assign a unique Chain ID to prevent replay attacks from other networks.

2.  **Cryptographic Audit**
    *   **Goal**: Ensure `secp256k1` implementation in `wallet.ts` and `chain.ts` is secure.
    *   **Action**: Hire a third-party security firm to review the signature verification logic and `LevelDB` storage integrity.

3.  **Network Transport Security**
    *   **TLS/SSL**: Upgrade `ws` (WebSockets) to `wss` (Secure WebSockets) for P2P communication.
    *   **DDoS Protection**: Implement rate-limiting at the P2P layer (not just API) to prevent node flooding.

## Phase 2: Public Infrastructure (Deployment)

1.  **Bootnodes (Seed Nodes)**
    *   **Action**: Deploy 3-5 reliable nodes on distributed cloud providers (e.g., AWS, DigitalOcean, Google Cloud).
    *   **DNS Seeding**: Map these IPs to a domain (e.g., `seeds.aetherium-nova.org`) so new nodes can find peers via DNS lookup instead of hardcoded IPs.

2.  **Containerization**
    *   Create a production `Dockerfile` to allow anyone to run a node with one command:
        ```bash
        docker run -d -p 3002:3002 -p 6001:6001 aetherium-nova/node:latest
        ```

3.  **Public Explorer & RPC**
    *   Example: `explorer.aetherium-nova.org`
    *   Example: `rpc.aetherium-nova.org` (Load balanced API for wallets/apps).

## Phase 3: Tools & Community (Adoption)

1.  **Official Wallets**
    *   Build a standalone Desktop/Mobile wallet (Electron/React Native) that connects to the Public RPC.
    *   Users should not need to run a full node to transact.

2.  **Whitepaper & Docs**
    *   Publish the technical whitepaper explaining the "Proof of Stake & Utility" (PoSU) consensus.
    *   Create a "Validator Guide" for community members to stake and run nodes.

## Phase 4: The Launch Event

1.  **Testnet "Incentivized" Phase**
    *   Run a public Testnet for 1 month. Reward users who find bugs or run reliable validators with Mainnet tokens.
    
2.  **Genesis Launch**
    *   Release the binaries.
    *   Start the Seed Nodes.
    *   Announce the "Genesis Block" hash.

---

## Action Plan: What can we do *right now*?

If you want to simulate this "Official" feel immediately:

1.  **Cloud Deployment**: Rent a small VPS ($5/mo), upload the code, and run `npm start` there.
2.  **Public Access**: Open ports 3002/6001 on the VPS firewall.
3.  **Connect Locally**: Update your local `network.config.json` to include your VPS IP address in `seedPeers`.
4.  **Result**: You and your friends can connect your local nodes to the Cloud Node, creating a real distributed network!
