import React, { useState, useRef, useEffect, useCallback } from "react";
import type { CliOutput } from "../types";

interface CliPageProps {
  history: CliOutput[];
  onCommand: (command: string) => void;
}

const LINE_COLOR: Record<CliOutput["type"], string> = {
  input: "text-cyan-400",
  output: "text-slate-300",
  error: "text-red-400",
  success: "text-emerald-400",
  info: "text-yellow-400",
};

const LINE_PREFIX: Record<CliOutput["type"], string> = {
  input: "",
  output: "  ",
  error: "✗ ",
  success: "✓ ",
  info: "⚡ ",
};

const QUICK_COMMANDS = [
  { label: "help", cmd: "help" },
  { label: "wallet.info", cmd: "wallet.info" },
  { label: "network.stats", cmd: "network.stats" },
  { label: "validators.list", cmd: "validators.list" },
  { label: "clear", cmd: "clear" },
];

export const CliPage: React.FC<CliPageProps> = ({ history, onCommand }) => {
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const submit = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;
      onCommand(trimmed);
      setCmdHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
      setHistoryIdx(-1);
      setInput("");
    },
    [onCommand],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistoryIdx((idx) => {
        const next = Math.min(idx + 1, cmdHistory.length - 1);
        setInput(cmdHistory[next] || "");
        return next;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistoryIdx((idx) => {
        const next = Math.max(idx - 1, -1);
        setInput(next >= 0 ? cmdHistory[next] || "" : "");
        return next;
      });
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Simple autocomplete from quick commands
      const match = QUICK_COMMANDS.find(
        (c) => c.cmd.startsWith(input) && c.cmd !== input,
      );
      if (match) setInput(match.cmd);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-white">CLI Terminal</h1>
        <p className="text-slate-500 text-sm mt-1">
          Interact with Aetherium Nova directly. Type{" "}
          <code className="text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">
            help
          </code>{" "}
          to see available commands.
        </p>
      </div>

      {/* Quick command shortcuts */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_COMMANDS.map(({ label, cmd }) => (
          <button
            key={cmd}
            onClick={() => submit(cmd)}
            className="px-3 py-1 text-xs font-mono bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 hover:text-cyan-400 text-slate-400 rounded-lg transition-all"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Terminal window */}
      <div
        className="scanline-container bg-black/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {/* macOS-style title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/60 border-b border-slate-700/50">
          <span className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
          <span className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
          <span className="flex-1 text-center text-xs text-slate-500 font-mono">
            aetherium-nova — bash
          </span>
          <span className="text-xs text-slate-600 font-mono">
            {cmdHistory.length} cmds
          </span>
        </div>

        {/* Output area */}
        <div className="px-5 py-4 min-h-[50vh] max-h-[60vh] overflow-y-auto font-mono text-sm leading-relaxed">
          {/* Welcome message */}
          {history.length === 0 && (
            <div className="text-slate-600 mb-3">
              <p className="text-cyan-400/60">Aetherium Nova CLI v2.0.0</p>
              <p>
                Type <span className="text-yellow-400">help</span> to see
                available commands.
              </p>
              <p className="text-slate-700 text-xs mt-1">
                Use ↑↓ arrow keys to navigate history, Tab to autocomplete
              </p>
            </div>
          )}

          {history.map((line, idx) => (
            <div
              key={idx}
              className={`${LINE_COLOR[line.type]} whitespace-pre-wrap break-words`}
            >
              {line.type === "input" ? (
                <span>
                  <span className="text-cyan-600 select-none">aetherium</span>
                  <span className="text-slate-600 select-none">@nova</span>
                  <span className="text-white select-none">:</span>
                  <span className="text-cyan-500 select-none">~</span>
                  <span className="text-white select-none">$ </span>
                  <span>{line.text.replace(/^> /, "")}</span>
                </span>
              ) : (
                <span>
                  {LINE_PREFIX[line.type]}
                  {line.text}
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input row */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-5 py-3 border-t border-slate-700/50 bg-black/40"
        >
          <div className="flex items-center gap-1 flex-shrink-0 text-xs font-mono select-none">
            <span className="text-cyan-600">aetherium</span>
            <span className="text-slate-600">@nova</span>
            <span className="text-white">:</span>
            <span className="text-cyan-500">~</span>
            <span className="text-white">$</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none placeholder-slate-700 caret-cyan-400"
            placeholder="Type a command…"
            autoFocus
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
          />
          <span className="cursor-blink text-cyan-400 text-lg leading-none select-none">
            ▌
          </span>
        </form>
      </div>

      {/* Help hint */}
      <p className="mt-3 text-xs text-slate-700 text-center font-mono">
        ↑↓ history · Tab autocomplete · Enter execute
      </p>
    </div>
  );
};
