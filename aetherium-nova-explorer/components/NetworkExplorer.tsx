import React, { useState, useCallback } from "react";
import type {
  Block,
  Transaction,
  NetworkStatsData,
  SearchResult,
} from "../types";
import { nodeService } from "../services/nodeService";

interface NetworkExplorerProps {
  stats: NetworkStatsData;
  transactions: Transaction[];
  mempool: Transaction[];
  blocks: Block[];
}

// ─── Utility ────────────────────────────────────────────────────────────────

function short(hash: string, start = 8, end = 6) {
  if (!hash || hash.length <= start + end + 2) return hash;
  return `${hash.slice(0, start)}…${hash.slice(-end)}`;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }, []);
  return { copy, copied };
}

function typeColor(type: Transaction["type"]) {
  switch (type) {
    case "TRANSFER":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
    case "STAKE":
      return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
    case "REWARD":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    default:
      return "bg-slate-700 text-slate-400 border-slate-600";
  }
}

function formatAmount(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(3)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(3)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(3)} K`;
  return n.toFixed(4);
}

// ─── Copy button ────────────────────────────────────────────────────────────

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const { copy, copied } = useCopy();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copy(text);
      }}
      className="ml-1 p-0.5 rounded text-slate-600 hover:text-cyan-400 transition-colors"
      title="Copy"
    >
      {copied === text ? (
        <svg
          className="w-3 h-3 text-green-400"
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
          className="w-3 h-3"
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
  );
};

// ─── Transaction Detail Modal ────────────────────────────────────────────────

const TxDetailModal: React.FC<{
  tx: Transaction | null;
  onClose: () => void;
}> = ({ tx, onClose }) => {
  if (!tx) return null;
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-xl shadow-black/50 animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">Transaction Detail</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${typeColor(tx.type)}`}
            >
              {tx.type}
            </span>
          </div>
          {[
            { label: "Hash", value: tx.hash },
            { label: "From", value: tx.from },
            { label: "To", value: tx.to },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-slate-300 break-all">
                  {value}
                </p>
                <CopyBtn text={value} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Amount</p>
              <p className="text-xl font-black text-white">
                {formatAmount(tx.amount)}{" "}
                <span className="text-cyan-400 text-base">AN</span>
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Timestamp</p>
              <p className="text-sm text-slate-300">
                {new Date(tx.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Signature</p>
            <p className="text-xs font-mono text-slate-500 break-all leading-relaxed">
              {tx.signature}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Block Detail Modal ──────────────────────────────────────────────────────

const BlockDetailModal: React.FC<{
  block: Block | null;
  onClose: () => void;
}> = ({ block, onClose }) => {
  if (!block) return null;
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-xl shadow-black/50 max-h-[90vh] overflow-y-auto animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-black text-sm">
              ◈
            </div>
            <h3 className="text-lg font-bold text-white">
              Block #{block.index.toLocaleString()}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Transactions</p>
              <p className="text-2xl font-black text-white">
                {block.transactions.length}
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Timestamp</p>
              <p className="text-sm text-slate-300">
                {new Date(block.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          {[
            { label: "Block Hash", value: block.hash },
            { label: "Previous Hash", value: block.previousHash },
            { label: "Merkle Root", value: block.merkleRoot },
            { label: "Validator", value: block.validator },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs font-mono text-slate-400 break-all">
                  {value}
                </p>
                <CopyBtn text={value} />
              </div>
            </div>
          ))}
          {block.transactions.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-400 mb-2">
                Included Transactions
              </p>
              <div className="space-y-2">
                {block.transactions.map((tx) => (
                  <div
                    key={tx.hash}
                    className="bg-slate-800/60 rounded-lg p-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs border ${typeColor(tx.type)}`}
                      >
                        {tx.type}
                      </span>
                      <span className="text-xs font-mono text-slate-500 truncate">
                        {short(tx.hash)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-white whitespace-nowrap">
                      {formatAmount(tx.amount)} AN
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Transaction Row ─────────────────────────────────────────────────────────

const TransactionRow: React.FC<{
  tx: Transaction;
  isMempool?: boolean;
  onClick: () => void;
}> = ({ tx, isMempool, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-3 p-3 border-b border-slate-800/80 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors group"
  >
    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-500 group-hover:text-cyan-400 transition-colors">
      {tx.type === "TRANSFER" ? "→" : tx.type === "STAKE" ? "◉" : "★"}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1">
        <span className="hash-text text-cyan-400/80 text-xs">
          {short(tx.hash)}
        </span>
        <CopyBtn text={tx.hash} />
      </div>
      <p className="text-xs text-slate-600 mt-0.5">
        {short(tx.from)} → {short(tx.to)}
      </p>
    </div>
    <div className="text-right flex-shrink-0">
      <p className="text-sm font-bold text-white">
        {formatAmount(tx.amount)}{" "}
        <span className="text-xs text-cyan-400">AN</span>
      </p>
      <span
        className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${typeColor(tx.type)}`}
      >
        {isMempool ? "⏳ " : ""}
        {tx.type}
      </span>
    </div>
  </div>
);

// ─── Block Row ────────────────────────────────────────────────────────────────

const BlockRow: React.FC<{ block: Block; onClick: () => void }> = ({
  block,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="flex items-center gap-3 p-3 border-b border-slate-800/80 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors group"
  >
    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-black text-xs">
      ◈
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-white">
        Block #{block.index.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <span className="hash-text text-slate-500 text-xs">
          {short(block.hash)}
        </span>
        <CopyBtn text={block.hash} />
      </div>
    </div>
    <div className="text-right flex-shrink-0">
      <p className="text-xs font-semibold text-slate-300">
        {block.transactions.length} txs
      </p>
      <p className="text-xs text-slate-600">
        {new Date(block.timestamp).toLocaleTimeString()}
      </p>
    </div>
  </div>
);

// ─── Section Card ─────────────────────────────────────────────────────────────

const SectionCard: React.FC<{
  title: string;
  count?: number;
  children: React.ReactNode;
}> = ({ title, count, children }) => (
  <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden card-cyber border-neon">
    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      {count !== undefined && (
        <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
    <div>{children}</div>
  </div>
);
// ─── Search Result Panel \u2500────────────────────────────────────────────────────────

const SearchResultPanel: React.FC<{
  result: SearchResult;
  onClose: () => void;
}> = ({ result, onClose }) => {
  const { copy, copied } = useCopy();
  const d = result.data;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-slate-800/60 rounded-xl p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-xs font-mono text-slate-300 break-all">{value}</p>
        <CopyBtn text={value} />
      </div>
    </div>
  );

  return (
    <div className="mb-6 bg-slate-900/80 border border-cyan-500/30 rounded-2xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">◈</span>
          <span className="text-sm font-semibold text-cyan-300">
            {result.type === "block"
              ? `Block #${d.index}`
              : result.type === "address"
                ? "Address"
                : result.type === "transaction"
                  ? d.confirmed
                    ? "Transaction (confirmed)"
                    : "Transaction (pending)"
                  : "Search Result"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="p-4 space-y-3">
        {result.type === "address" && (
          <>
            <Row label="Address" value={d.address!} />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Balance</p>
                <p className="text-xl font-black text-white">
                  {(d.balance ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  <span className="text-cyan-400 text-sm">AN</span>
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Nonce</p>
                <p className="text-xl font-black text-white">{d.nonce ?? 0}</p>
              </div>
            </div>
          </>
        )}
        {result.type === "block" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Height</p>
                <p className="text-lg font-black text-white">#{d.index}</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Txns</p>
                <p className="text-lg font-black text-white">
                  {(d.transactions ?? []).length}
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Time</p>
                <p className="text-xs text-slate-300">
                  {d.timestamp ? new Date(d.timestamp).toLocaleString() : "—"}
                </p>
              </div>
            </div>
            {d.hash && <Row label="Hash" value={d.hash} />}
          </>
        )}
        {result.type === "transaction" && d.tx && (
          <>
            <Row label="Hash" value={d.tx.hash} />
            <Row label="From" value={d.tx.from} />
            <Row label="To" value={d.tx.to} />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Amount</p>
                <p className="text-xl font-black text-white">
                  {formatAmount(d.tx.amount)}{" "}
                  <span className="text-cyan-400 text-sm">AN</span>
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Block</p>
                <p className="text-lg font-black text-white">
                  {d.blockIndex != null ? `#${d.blockIndex}` : "Pending"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
// ─── Main Component ───────────────────────────────────────────────────────────

export const NetworkExplorer: React.FC<NetworkExplorerProps> = ({
  stats,
  transactions,
  mempool,
  blocks,
}) => {
  const [filterType, setFilterType] = useState<"ALL" | Transaction["type"]>(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [apiSearchResult, setApiSearchResult] = useState<SearchResult | null>(
    null,
  );
  const [apiSearching, setApiSearching] = useState(false);

  const isExactQuery = (q: string) =>
    /^0x[0-9a-fA-F]{40}$/.test(q) ||
    /^[0-9a-fA-F]{64}$/.test(q) ||
    /^\d+$/.test(q.trim());

  const handleSearchSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!search.trim()) {
        setApiSearchResult(null);
        return;
      }
      setApiSearching(true);
      const result = await nodeService.search(search.trim());
      setApiSearchResult(result);
      setApiSearching(false);
    },
    [search],
  );

  const filterTypes: Array<{ id: "ALL" | Transaction["type"]; label: string }> =
    [
      { id: "ALL", label: "All" },
      { id: "TRANSFER", label: "Transfers" },
      { id: "STAKE", label: "Stakes" },
      { id: "REWARD", label: "Rewards" },
    ];

  const matchSearch = (tx: Transaction) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tx.hash.toLowerCase().includes(q) ||
      tx.from.toLowerCase().includes(q) ||
      tx.to.toLowerCase().includes(q)
    );
  };

  const matchFilterAndSearch = (tx: Transaction) =>
    (filterType === "ALL" || tx.type === filterType) && matchSearch(tx);

  const filteredMempool = mempool.filter(matchFilterAndSearch);
  const filteredTransactions = transactions.filter(matchFilterAndSearch);

  // Also search in blocks
  const filteredBlocks = search
    ? blocks.filter(
        (b) =>
          b.hash.toLowerCase().includes(search.toLowerCase()) ||
          String(b.index).includes(search),
      )
    : blocks;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Network Explorer</h1>
          <p className="text-slate-500 text-sm mt-1">
            Block {stats.blockHeight.toLocaleString()} · {mempool.length}{" "}
            pending
          </p>
        </div>

        {/* Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative w-full sm:w-80 flex gap-2"
        >
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) setApiSearchResult(null);
              }}
              placeholder="Hash, address, or block #…"
              className="input-cyber w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setApiSearchResult(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {isExactQuery(search) && (
            <button
              type="submit"
              disabled={apiSearching}
              className="flex-shrink-0 px-3 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {apiSearching ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full" />
              ) : (
                "◈"
              )}
            </button>
          )}
        </form>
      </div>

      {/* API search result */}
      {apiSearchResult && (
        <SearchResultPanel
          result={apiSearchResult}
          onClose={() => setApiSearchResult(null)}
        />
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {filterTypes.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilterType(id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              filterType === id
                ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300"
                : "bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
            }`}
          >
            {label}
            {id !== "ALL" && (
              <span className="ml-1.5 text-xs opacity-60">
                {
                  (id === "TRANSFER"
                    ? transactions.filter((t) => t.type === "TRANSFER")
                    : id === "STAKE"
                      ? transactions.filter((t) => t.type === "STAKE")
                      : transactions.filter((t) => t.type === "REWARD")
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: mempool + blocks */}
        <div className="lg:col-span-1 space-y-6">
          <SectionCard title="Mempool" count={filteredMempool.length}>
            <div className="max-h-80 overflow-y-auto">
              {filteredMempool.length > 0 ? (
                filteredMempool.map((tx) => (
                  <TransactionRow
                    key={tx.hash}
                    tx={tx}
                    isMempool
                    onClick={() => setSelectedTx(tx)}
                  />
                ))
              ) : (
                <p className="text-slate-500 text-sm text-center py-8">
                  {search ? "No matching transactions" : "Mempool is empty"}
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Latest Blocks" count={filteredBlocks.length}>
            <div className="max-h-96 overflow-y-auto">
              {filteredBlocks.length > 0 ? (
                filteredBlocks.map((block) => (
                  <BlockRow
                    key={block.hash}
                    block={block}
                    onClick={() => setSelectedBlock(block)}
                  />
                ))
              ) : (
                <p className="text-slate-500 text-sm text-center py-8">
                  No blocks match your search
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right column: confirmed transactions */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Confirmed Transactions"
            count={filteredTransactions.length}
          >
            <div className="max-h-[856px] overflow-y-auto">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <TransactionRow
                    key={tx.hash}
                    tx={tx}
                    onClick={() => setSelectedTx(tx)}
                  />
                ))
              ) : (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">◈</p>
                  <p className="text-slate-500">
                    {search
                      ? "No transactions match your search"
                      : filterType === "ALL"
                        ? "No confirmed transactions yet"
                        : `No ${filterType} transactions found`}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Modals */}
      <TxDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
      <BlockDetailModal
        block={selectedBlock}
        onClose={() => setSelectedBlock(null)}
      />
    </div>
  );
};
