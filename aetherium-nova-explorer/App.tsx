import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Footer } from "./components/Footer";
import { ConceptCard } from "./components/ConceptCard";
import { NetworkStats } from "./components/NetworkStats";
import { WhitepaperModal } from "./components/WhitepaperModal";
import { NetworkExplorer } from "./components/NetworkExplorer";
import { WalletPage } from "./components/WalletPage";
import { StakingPage } from "./components/StakingPage";
import { CliPage } from "./components/CliPage";
import type {
  Concept,
  NetworkStatsData,
  Transaction,
  Block,
  Wallet,
  Validator,
  CliOutput,
  UnsignedTransaction,
} from "./types";
import { nodeService } from "./services/nodeService";
import { getTransactionHash, sign } from "./cryptoUtils";

import { LockIcon } from "./components/icons/LockIcon";
import { CubeIcon } from "./components/icons/CubeIcon";
import { CpuIcon } from "./components/icons/CpuIcon";
import { NetworkIcon } from "./components/icons/NetworkIcon";
import { ShieldIcon } from "./components/icons/ShieldIcon";
import { RocketIcon } from "./components/icons/RocketIcon";

const App: React.FC = () => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState<
    "home" | "network" | "wallet" | "staking" | "cli"
  >("home");

  // Local state reflecting the "API" data
  const [stats, setStats] = useState<NetworkStatsData | null>(null);
  const [mempool, setMempool] = useState<Transaction[]>([]);
  const [confirmedTransactions, setConfirmedTransactions] = useState<
    Transaction[]
  >([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [validators, setValidators] = useState<Omit<Validator, "secretKey">[]>(
    [],
  );

  // Client-side wallet state
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const [cliHistory, setCliHistory] = useState<CliOutput[]>([
    {
      text: "Aetherium Nova CLI. Type 'help' to see available commands.",
      type: "info",
    },
  ]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load wallet from localStorage on startup
  useEffect(() => {
    try {
      const savedWallet = localStorage.getItem("aetherium-nova-wallet");
      if (savedWallet) {
        setWallet(JSON.parse(savedWallet));
      }
    } catch (error) {
      console.error("Failed to load wallet from localStorage:", error);
      localStorage.removeItem("aetherium-nova-wallet");
    }
  }, []);

  // Sync wallet balance with backend state
  useEffect(() => {
    if (wallet?.publicKey) {
      nodeService.getWalletState(wallet.publicKey).then((walletState) => {
        if (walletState) {
          setWallet((w) =>
            w
              ? {
                  ...w,
                  balance: walletState.balance,
                  stakes: walletState.stakes,
                }
              : null,
          );
        }
      });
    }
  }, [blocks, wallet?.publicKey]); // Re-sync wallet after every new block

  // Save wallet to localStorage whenever it changes
  // SECURITY: Never persist secretKey to localStorage — it stays in React state only.
  // Users must back up their private key separately. On page reload the wallet
  // address and balance are restored but signing requires the key from memory.
  useEffect(() => {
    if (wallet) {
      const { secretKey: _omit, ...walletToStore } = wallet as any;
      localStorage.setItem(
        "aetherium-nova-wallet",
        JSON.stringify(walletToStore),
      );
    } else {
      localStorage.removeItem("aetherium-nova-wallet");
    }
  }, [wallet]);

  // Data fetching loop
  const syncWithNode = useCallback(async () => {
    try {
      const state = await nodeService.getNetworkState();
      setStats(state.stats);
      setMempool(state.mempool);
      setBlocks(state.blocks);
      setValidators(state.validators);
      // Flatten confirmed transactions from all blocks (most recent first)
      const allTxs: Transaction[] = state.blocks.flatMap((b: Block) =>
        (b.transactions ?? []).map((tx: Transaction) => ({
          ...tx,
          timestamp: tx.timestamp ?? b.timestamp,
        })),
      );
      setConfirmedTransactions(allTxs);
      setSyncError(null);
    } catch (error) {
      console.error("Error syncing with node:", error);
      if (error instanceof Error) {
        setSyncError(error.message);
      } else {
        setSyncError("An unknown error occurred during sync.");
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
      await syncWithNode();
      if (isMounted) {
        setTimeout(sync, 3000);
      }
    };
    sync();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once

  const generateNewWallet = async () => {
    const newWalletData = await nodeService.createWallet();
    setWallet(newWalletData);
  };

  const submitTransaction = async (
    txData: UnsignedTransaction,
  ): Promise<{ success: boolean; message: string }> => {
    if (!wallet)
      return {
        success: false,
        message: "No wallet available to sign transaction.",
      };

    const txHash = getTransactionHash(txData);
    const signature = sign(txHash, wallet.secretKey);

    const newTx: Transaction = {
      ...txData,
      hash: txHash,
      signature: signature,
    };

    const result = await nodeService.submitTransaction(newTx);
    if (result.success) {
      // Optimistically add to mempool for instant UI feedback
      setMempool((prev) => [newTx, ...prev]);
      // Optimistically update balance
      if (txData.type !== "REWARD") {
        setWallet((w) =>
          w ? { ...w, balance: w.balance - txData.amount } : null,
        );
      }
    }
    return result;
  };

  const handleSend = (recipient: string, amount: number) => {
    if (!wallet)
      return Promise.resolve({
        success: false,
        message: "Error: No active wallet.",
      });
    if (!recipient || recipient.length < 10)
      return Promise.resolve({
        success: false,
        message: "Error: Invalid recipient address.",
      });

    const pendingSentAmount = mempool
      .filter(
        (tx) =>
          tx.from === wallet.publicKey &&
          (tx.type === "TRANSFER" || tx.type === "STAKE"),
      )
      .reduce((acc, tx) => acc + tx.amount, 0);

    if (wallet.balance - pendingSentAmount < amount) {
      return Promise.resolve({
        success: false,
        message: "Error: Insufficient balance.",
      });
    }

    return submitTransaction({
      from: wallet.publicKey,
      to: recipient,
      amount,
      timestamp: Date.now(),
      type: "TRANSFER",
    });
  };

  const handleStake = (validatorAddress: string, amount: number) => {
    if (!wallet)
      return Promise.resolve({
        success: false,
        message: "Error: No active wallet.",
      });

    const validatorExists = validators.some(
      (v) => v.publicKey === validatorAddress,
    );
    if (!validatorExists)
      return Promise.resolve({
        success: false,
        message: "Error: Validator not found.",
      });

    const pendingSentAmount = mempool
      .filter(
        (tx) =>
          tx.from === wallet.publicKey &&
          (tx.type === "TRANSFER" || tx.type === "STAKE"),
      )
      .reduce((acc, tx) => acc + tx.amount, 0);

    if (wallet.balance - pendingSentAmount < amount) {
      return Promise.resolve({
        success: false,
        message: "Error: Insufficient balance.",
      });
    }

    // Optimistically update UI for staking position before API call
    setWallet((w) => {
      if (!w) return null;
      const existingStakeIndex = w.stakes.findIndex(
        (s) => s.validatorAddress === validatorAddress,
      );
      let newStakes = [...w.stakes];
      if (existingStakeIndex > -1) {
        newStakes[existingStakeIndex].amount += amount;
      } else {
        newStakes.push({ validatorAddress, amount, rewards: 0 });
      }
      return { ...w, stakes: newStakes };
    });
    setValidators((v) =>
      v.map((val) =>
        val.publicKey === validatorAddress
          ? { ...val, totalStake: val.totalStake + amount }
          : val,
      ),
    );

    return submitTransaction({
      from: wallet.publicKey,
      to: validatorAddress,
      amount,
      timestamp: Date.now(),
      type: "STAKE",
    });
  };

  const handleClaimRewards = async () => {
    if (!wallet?.publicKey) return;
    const result = await nodeService.claimRewards(wallet.publicKey);
    if (result.success) {
      // Re-sync wallet state from backend to get precise new balance
      const walletState = await nodeService.getWalletState(wallet.publicKey);
      if (walletState) {
        setWallet((w) =>
          w
            ? { ...w, balance: walletState.balance, stakes: walletState.stakes }
            : null,
        );
      }
    }
    alert(result.message);
  };

  const handleFaucet = async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    if (!wallet?.publicKey)
      return { success: false, message: "No wallet loaded." };
    const result = await nodeService.claimFaucet(wallet.publicKey);
    if (result.success) {
      // Refresh balance immediately
      const walletState = await nodeService.getWalletState(wallet.publicKey);
      if (walletState) {
        setWallet((w) => (w ? { ...w, balance: walletState.balance } : null));
      }
    }
    return result;
  };

  const handleCliCommand = async (command: string) => {
    const parts = command
      .trim()
      .split(" ")
      .filter((p) => p);
    const cmd = parts[0];
    const args = parts.slice(1);
    const newHistory: CliOutput[] = [
      ...cliHistory,
      { text: `> ${command}`, type: "input" },
    ];
    setCliHistory(newHistory);

    let output: CliOutput[] = [];

    switch (cmd) {
      case "help":
        output.push({ type: "info", text: "Available Commands:" });
        output.push({
          type: "output",
          text: "  help                    - Show this help message",
        });
        output.push({
          type: "output",
          text: "  wallet.info             - Display wallet address and balance",
        });
        output.push({
          type: "output",
          text: "  wallet.send <addr> <amt> - Send AN tokens to an address",
        });
        output.push({
          type: "output",
          text: "  network.stats           - Show live network statistics",
        });
        output.push({
          type: "output",
          text: "  validators.list         - List all available validators",
        });
        output.push({
          type: "output",
          text: "  stake <addr> <amt>      - Stake AN tokens with a validator",
        });
        output.push({
          type: "output",
          text: "  clear                   - Clear the terminal",
        });
        break;

      case "wallet.info":
        if (wallet) {
          const pendingSentAmount = mempool
            .filter(
              (tx) =>
                tx.from === wallet.publicKey &&
                (tx.type === "TRANSFER" || tx.type === "STAKE"),
            )
            .reduce((acc, tx) => acc + tx.amount, 0);
          output.push({
            type: "output",
            text: `PublicKey: ${wallet.publicKey}`,
          });
          output.push({
            type: "output",
            text: `Balance: ${wallet.balance.toFixed(4)} AN`,
          });
          if (pendingSentAmount > 0) {
            output.push({
              type: "info",
              text: ` (Available: ${(
                wallet.balance - pendingSentAmount
              ).toFixed(4)} AN considering mempool)`,
            });
          }
        } else {
          output.push({
            type: "error",
            text: "No wallet found. Go to the Wallet page to create one.",
          });
        }
        break;

      case "wallet.send":
        if (args.length === 2) {
          const [addr, amtStr] = args;
          const amount = parseFloat(amtStr);
          const result = await handleSend(addr, amount);
          output.push({
            type: result.success ? "success" : "error",
            text: result.message,
          });
        } else {
          output.push({
            type: "error",
            text: "Usage: wallet.send <address> <amount>",
          });
        }
        break;

      case "network.stats":
        if (stats) {
          output.push({
            type: "output",
            text: `Current Block: ${stats.blockHeight.toLocaleString()}`,
          });
          output.push({
            type: "output",
            text: `TPS: ${stats.tps.toLocaleString()}`,
          });
          output.push({
            type: "output",
            text: `Active Nodes: ${stats.activeNodes.toLocaleString()}`,
          });
          output.push({
            type: "output",
            text: `Mempool: ${mempool.length} transactions`,
          });
        } else {
          output.push({ type: "info", text: "Fetching network stats..." });
        }
        break;

      case "validators.list":
        output.push({ type: "info", text: "Available Validators:" });
        validators.forEach((v) => {
          output.push({
            type: "output",
            text: `- ${v.name} (${v.publicKey}) | APR: ${v.apr}%`,
          });
        });
        break;

      case "stake":
        if (args.length === 2) {
          const [addr, amtStr] = args;
          const amount = parseFloat(amtStr);
          const result = await handleStake(addr, amount);
          output.push({
            type: result.success ? "success" : "error",
            text: result.message,
          });
        } else {
          output.push({
            type: "error",
            text: "Usage: stake <validator_publicKey> <amount>",
          });
        }
        break;

      case "clear":
        setCliHistory([]);
        return;

      default:
        output.push({ type: "error", text: `Command not found: ${cmd}` });
    }
    setCliHistory((h) => [...h, ...output]);
  };

  const concepts: Concept[] = [
    {
      icon: <LockIcon />,
      title: "Quantum Resistance",
      description:
        "Built with Post-Quantum Cryptography (PQC) to safeguard against threats from future quantum computers, ensuring long-term security.",
    },
    {
      icon: <CubeIcon />,
      title: "Hybrid Consensus (PoSU)",
      description:
        "A novel Proof-of-Stake & Utility mechanism. It secures the network efficiently while rewarding nodes for contributing to valuable computational tasks.",
    },
    {
      icon: <CpuIcon />,
      title: "Decentralized Computation",
      description:
        "Beyond transactions, the network functions as a global supercomputer, allowing for complex, decentralized applications and services.",
    },
    {
      icon: <NetworkIcon />,
      title: "Dynamic State Sharding",
      description:
        "To ensure scalability and prevent blockchain bloat, the network dynamically partitions its state, keeping nodes lightweight and fast.",
    },
    {
      icon: <ShieldIcon />,
      title: "Enhanced Privacy (ZKPs)",
      description:
        "Leverages Zero-Knowledge Proofs to offer optional, fully private transactions, shielding user data without compromising network integrity.",
    },
    {
      icon: <RocketIcon />,
      title: "Advanced Incentive Model",
      description:
        "Rewards are distributed not just for block creation but also for providing utility, storage, and bandwidth, fostering a robust and versatile ecosystem.",
    },
  ];

  const renderHomePage = () => (
    <>
      <main>
        <Hero
          stats={stats}
          setPage={setPage}
          onOpenWhitepaper={() => setModalOpen(true)}
        />
        <section
          id="introduction"
          className="py-24 px-4 sm:px-6 lg:px-8 text-center"
        >
          <div className="max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-6">
              ◈ Next-Generation Infrastructure
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
              The Next Leap in
              <br />
              <span className="text-gradient-cyber">Digital Freedom</span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Aetherium Nova re-imagines the principles of Bitcoin for the next
              generation. It's not just a peer-to-peer electronic cash system;
              it's a secure, decentralized platform for value and computation,
              engineered to be resilient, scalable, and intrinsically useful.
            </p>
          </div>
        </section>
        <section
          id="features"
          className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/30 relative"
        >
          <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
          <div className="relative max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
                Core Innovations
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                Six foundational technologies that make Aetherium Nova uniquely
                suited for the decades ahead.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {concepts.map((concept, index) => (
                <ConceptCard
                  key={index}
                  icon={concept.icon}
                  title={concept.title}
                  description={concept.description}
                />
              ))}
            </div>
          </div>
        </section>
        {stats && <NetworkStats stats={stats} />}
        <section
          id="conclusion"
          className="py-24 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/10 to-indigo-950/20 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">
              Building a Smarter,
              <br />
              <span className="text-gradient-cyber">More Secure Future</span>
            </h2>
            <p className="text-lg text-slate-400 mb-10 leading-relaxed">
              By combining post-quantum security with a utility-driven
              consensus, Aetherium Nova provides a foundation for a new wave of
              decentralized innovation. Join us in building a more resilient and
              equitable digital world.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setModalOpen(true)}
                className="btn-cyber bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-4 px-10 rounded-full transition-all duration-300 shadow-glow-cyan"
              >
                Read the Whitepaper
              </button>
              <button
                onClick={() => setPage("network")}
                className="btn-cyber border border-slate-700 hover:border-cyan-500/50 text-white font-semibold py-4 px-10 rounded-full transition-all duration-300 hover:bg-cyan-500/5"
              >
                Explore the Chain
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );

  return (
    <div className="bg-slate-950 text-slate-300 min-h-screen font-sans">
      <div className="relative z-10">
        <Header
          currentPage={page}
          setPage={setPage}
          isSyncing={isSyncing}
          walletAddress={wallet?.publicKey}
        />
        {syncError && (
          <div className="mx-auto max-w-7xl px-4 pt-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <span>⚠</span>
              <span>Node unreachable: {syncError}. Retrying...</span>
            </div>
          </div>
        )}
        {page === "home" && renderHomePage()}
        {stats && page === "network" && (
          <NetworkExplorer
            stats={stats}
            transactions={confirmedTransactions}
            mempool={mempool}
            blocks={blocks}
          />
        )}
        {page === "wallet" && (
          <WalletPage
            wallet={wallet}
            createWallet={generateNewWallet}
            transactions={confirmedTransactions}
            setPage={setPage}
            onSend={handleSend}
            mempool={mempool}
            setWallet={setWallet}
            onFaucet={handleFaucet}
          />
        )}
        {page === "staking" && (
          <StakingPage
            wallet={wallet}
            validators={validators}
            onStake={handleStake}
            onClaimRewards={handleClaimRewards}
          />
        )}
        {page === "cli" && (
          <CliPage history={cliHistory} onCommand={handleCliCommand} />
        )}
      </div>
      <WhitepaperModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default App;
