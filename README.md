🚀 Aetherium Nova v2
Aetherium Nova v2 is a full-featured, educational blockchain implementation built with Node.js and TypeScript. This project serves as a comprehensive backend for a decentralized network, showcasing the core components required to run a blockchain from the ground up, including a decentralized ledger, a peer-to-peer network, and a virtual machine for executing smart contracts.

It is designed to demonstrate the fundamental concepts of blockchain technology in a hands-on, runnable environment.

✨ Core Features
This project embodies the key functionalities of a modern blockchain.

Decentralized Network: A robust peer-to-peer network layer that allows for communication and data synchronization between multiple nodes.

Blockchain & Ledger: A secure, append-only data structure that manages an immutable chain of blocks, while the ledger tracks the global state of the network.

Transaction Pool (Mempool): A temporary holding area for unconfirmed transactions, ensuring they are ready to be included in the next block.

Proof-of-Stake & Utility (PoSU): A custom consensus mechanism that rewards validators for securing the network and contributing computational utility.

Smart Contracts: A basic framework for creating and executing self-enforcing agreements on a custom Virtual Machine (VM).

Command-Line Interface (CLI): A powerful, interactive tool for users to engage with the blockchain, allowing them to query data, send transactions, and manage their wallets.

📂 Project Structure
The project is organized into logical directories to ensure scalability, modularity, and maintainability.

src/: The root directory containing all of the project's source code.

src/commands/: Houses the different command modules for the CLI, such as mine.ts, query.ts, staking.ts, and transaction.ts.

src/contracts/: Contains the code for smart contracts that can be deployed onto the network.

src/services/: Includes services that abstract away specific functionalities, such as the apiService for external interactions.

src/utils/: A collection of reusable helper functions for cryptographic operations, CLI parsing, and other utilities.

src/chain.ts: The central file for the blockchain's core logic, including block creation and validation.

src/ledger.ts: Manages the state and balances of the network.

src/node.ts: The main entry point for a running blockchain node.

src/staking.ts: The implementation of the Proof-of-Stake consensus logic.

src/vm.ts: The virtual machine responsible for executing smart contract code.

src/wallet.ts: Manages all wallet-related functionalities, including key generation and transaction signing.

🛠️ Technology Stack
Node.js: The JavaScript runtime environment that powers the application.

TypeScript: A superset of JavaScript that adds static typing, improving code quality and reducing bugs.

npm: The default package manager for Node.js, used to manage project dependencies.

🚀 Getting Started
To get the project running locally, follow these simple steps.

Clone the repository:

git clone [https://github.com/your-username/aetherium-nova-v2.git](https://github.com/your-username/aetherium-nova-v2.git)
cd aetherium-nova-v2

Install the dependencies:

npm install

Run the node:

npm start

This command will start a local blockchain node. You can then use the provided CLI to interact with it, creating new wallets, sending transactions, and exploring the network.

⚠️ Disclaimer
This is a conceptual and educational project. It is not connected to a live blockchain network and should not be used for real-world cryptocurrency transactions. The cryptographic functions and network logic are simplified for demonstration purposes.
