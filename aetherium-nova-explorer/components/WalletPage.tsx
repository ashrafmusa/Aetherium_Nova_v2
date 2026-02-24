import React, { useState, useCallback, useRef } from "react";
import type { Wallet, Transaction } from "../types";
import { sha256 } from "js-sha256";
import { ec as EC } from "elliptic";

const ec = new EC("secp256k1");

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}

function deriveAddress(pubHex: string): string {
  return "0x" + sha256(hexToBytes(pubHex)).slice(0, 40);
}

/** Browser-native AES-256-GCM decrypt using PBKDF2-SHA512 (matches backend) */
async function decryptWalletFile(
  encrypted: string,
  passphrase: string,
): Promise<string> {
  const [ivHex, saltHex, authTagHex, encHex] = encrypted.split(":");
  if (!ivHex || !saltHex || !authTagHex || !encHex)
    throw new Error("Invalid format");
  const fromHex = (h: string) =>
    Uint8Array.from(h.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const iv = fromHex(ivHex);
  const salt = fromHex(saltHex);
  const authTag = fromHex(authTagHex);
  const enc = fromHex(encHex);

  const enc2 = new Uint8Array(enc.length + authTag.length);
  enc2.set(enc);
  enc2.set(authTag, enc.length);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-512" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    enc2,
  );
  return new TextDecoder().decode(decrypted);
}

interface WalletPageProps {
  wallet: Wallet | null;
  createWallet: () => Promise<void>;
  transactions: Transaction[];
  setPage: (page: "staking") => void;
  onSend: (
    recipient: string,
    amount: number,
  ) => Promise<{ success: boolean; message: string }>;
  mempool: Transaction[];
  setWallet?: (w: Wallet) => void;
}

// ─── Clipboard hook ───────────────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);
  return { copy, copied };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function typeColor(type: Transaction["type"]) {
  switch (type) {
    case "TRANSFER":
      return "text-cyan-400";
    case "STAKE":
      return "text-indigo-400";
    case "REWARD":
      return "text-green-400";
    default:
      return "text-slate-400";
  }
}

const TransactionRow: React.FC<{ tx: Transaction; walletAddress: string }> = ({
  tx,
  walletAddress,
}) => {
  const isSent = tx.from === walletAddress;
  return (
    <tr className="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors">
      <td className="p-3 text-xs font-mono text-cyan-400/80">
        {tx.hash.slice(0, 10)}…
      </td>
      <td className={`p-3 text-xs font-semibold ${typeColor(tx.type)}`}>
        {tx.type}
      </td>
      <td
        className={`p-3 text-sm font-bold ${isSent ? "text-red-400" : "text-emerald-400"}`}
      >
        {isSent ? "–" : "+"}{" "}
        {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        <span className="text-xs ml-1 opacity-70">AN</span>
      </td>
      <td className="p-3 text-xs text-slate-500 hidden sm:table-cell">
        {new Date(tx.timestamp).toLocaleString()}
      </td>
    </tr>
  );
};

// ─── No Wallet View ───────────────────────────────────────────────────────────

interface NoWalletProps {
  onCreate: () => Promise<void>;
  onLoadFile: (file: File, pass: string) => Promise<void>;
}

const NoWalletView: React.FC<NoWalletProps> = ({ onCreate, onLoadFile }) => {
  const [tab, setTab] = useState<"create" | "load">("create");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !password) {
      setError("Please select a file and enter a password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onLoadFile(file, password);
    } catch (err: any) {
      setError(err.message || "Failed to decrypt wallet. Wrong password?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-16 px-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-3xl">
          ◇
        </div>
        <h2 className="text-3xl font-black text-white">Wallet</h2>
        <p className="text-slate-400 mt-2">
          Create a new wallet or import an existing one.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-800/50 border border-slate-700 p-1 mb-6">
        {(["create", "load"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === t ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            {t === "create" ? "⊕ Create New" : "⊙ Import from File"}
          </button>
        ))}
      </div>

      {tab === "create" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 card-cyber text-center">
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            A new secp256k1 key pair will be generated securely in your browser.
            Your private key{" "}
            <strong className="text-white">never leaves this device</strong>.
          </p>
          <button
            onClick={onCreate}
            className="btn-cyber w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-glow-cyan"
          >
            Generate New Wallet
          </button>
        </div>
      )}

      {tab === "load" && (
        <form
          onSubmit={handleLoad}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 card-cyber space-y-4"
        >
          <p className="text-slate-400 text-sm leading-relaxed">
            Upload an encrypted wallet JSON file exported by the Aetherium Nova
            CLI.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Wallet File (.json)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors group"
            >
              <p className="text-slate-500 group-hover:text-slate-300 transition-colors">
                {file ? (
                  <span className="text-cyan-400">{file.name}</span>
                ) : (
                  "Click to select wallet file"
                )}
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter wallet password"
              className="input-cyber w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-cyber w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-8 rounded-full transition-all disabled:opacity-50"
          >
            {loading ? "Decrypting…" : "Import Wallet"}
          </button>
        </form>
      )}
    </div>
  );
};

// ─── Main Wallet View ─────────────────────────────────────────────────────────

export const WalletPage: React.FC<WalletPageProps> = ({
  wallet,
  createWallet,
  transactions,
  setPage,
  onSend,
  mempool,
  setWallet,
}) => {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendMsg, setSendMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const { copy, copied } = useCopy();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const sendAmount = parseFloat(amount);
    if (isNaN(sendAmount) || sendAmount <= 0) {
      setSendMsg({ text: "Enter a valid amount.", ok: false });
      return;
    }
    setSending(true);
    const result = await onSend(recipient, sendAmount);
    setSendMsg({ text: result.message, ok: result.success });
    if (result.success) {
      setRecipient("");
      setAmount("");
    }
    setSending(false);
  };

  const handleLoadFile = async (file: File, pass: string) => {
    const text = await file.text();
    const data = JSON.parse(text);
    const encryptedPrivateKey: string = data.privateKey;
    const storedPubKey: string = data.publicKey;
    if (!encryptedPrivateKey || !storedPubKey)
      throw new Error("Invalid wallet file structure.");

    const privateKeyHex = await decryptWalletFile(encryptedPrivateKey, pass);

    // Derive address from private key
    const keyPair = ec.keyFromPrivate(privateKeyHex, "hex");
    const pubHex = keyPair.getPublic("hex");
    const address = deriveAddress(pubHex);

    const importedWallet: Wallet = {
      publicKey: address,
      secretKey: privateKeyHex,
      balance: 0,
      stakes: [],
    };
    setWallet?.(importedWallet);
  };

  if (!wallet) {
    return <NoWalletView onCreate={createWallet} onLoadFile={handleLoadFile} />;
  }

  const pendingSent = mempool
    .filter(
      (tx) =>
        tx.from === wallet.publicKey &&
        (tx.type === "TRANSFER" || tx.type === "STAKE"),
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
  const available = wallet.balance - pendingSent;
  const walletTxs = transactions.filter(
    (tx) => tx.from === wallet.publicKey || tx.to === wallet.publicKey,
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Wallet</h1>
          <p className="text-slate-500 text-sm mt-1">
            {walletTxs.length} transactions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-5">
          {/* Balance card */}
          <div className="card-cyber bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl -translate-y-12 translate-x-12 pointer-events-none" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Total Balance
            </p>
            <p className="text-5xl font-black text-white leading-none">
              {wallet.balance.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}
            </p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">AN</p>
            {pendingSent > 0 && (
              <p className="text-sm text-yellow-400 mt-3 flex items-center gap-1">
                <span>⏳</span>
                <span>Available: {available.toFixed(4)} AN</span>
              </p>
            )}
            <div className="mt-5 pt-5 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-1.5">Address</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs text-slate-300 break-all leading-relaxed">
                  {wallet.publicKey}
                </p>
                <button
                  onClick={() => copy(wallet.publicKey)}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-all"
                  title="Copy address"
                >
                  {copied ? (
                    <svg
                      className="w-3.5 h-3.5 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => setPage("staking")}
              className="btn-cyber mt-5 w-full bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 font-semibold py-2.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              <span>◉</span> Go to Staking
            </button>
          </div>

          {/* Send card */}
          <div className="card-cyber bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <span className="text-cyan-400">→</span> Send AN
            </h3>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x…"
                  className="input-cyber w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Amount
                  <span className="ml-1 text-slate-600">
                    (max: {available.toFixed(4)} AN)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0000"
                    min="0"
                    step="any"
                    className="input-cyber w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400 font-semibold pointer-events-none">
                    AN
                  </span>
                </div>
              </div>
              <button
                type="submit"
                disabled={sending}
                className="btn-cyber w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full" />{" "}
                    Sending…
                  </>
                ) : (
                  <>
                    <span>→</span> Send Transaction
                  </>
                )}
              </button>
            </form>
            {sendMsg && (
              <div
                className={`mt-4 p-3 rounded-xl text-sm text-center ${sendMsg.ok ? "bg-green-500/15 border border-green-500/30 text-green-400" : "bg-red-500/15 border border-red-500/30 text-red-400"}`}
              >
                {sendMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* Transaction history */}
        <div className="lg:col-span-2">
          <div className="card-cyber bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden border-neon">
            <div className="px-5 py-4 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">
                Transaction History
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {walletTxs.length} txns
              </span>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {walletTxs.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                    <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Hash</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletTxs.map((tx) => (
                      <TransactionRow
                        key={tx.hash}
                        tx={tx}
                        walletAddress={wallet.publicKey}
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">◇</p>
                  <p className="text-slate-500 text-sm">No transactions yet</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Transactions will appear here once confirmed.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
