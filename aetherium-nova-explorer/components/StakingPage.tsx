import React, { useState, useMemo } from "react";
import type { Wallet, Validator } from "../types";

interface StakingPageProps {
  wallet: Wallet | null;
  validators: Omit<Validator, "secretKey">[];
  onStake: (
    validatorAddress: string,
    amount: number,
  ) => Promise<{ success: boolean; message: string }>;
  onClaimRewards: () => Promise<void>;
}

// ─── Validator Card ────────────────────────────────────────────────────────────

const ValidatorCard: React.FC<{
  validator: Omit<Validator, "secretKey">;
  stakedAmount: number;
  maxStake: number;
  onStake: (amount: number) => void;
  disabled: boolean;
}> = ({ validator, stakedAmount, maxStake, onStake, disabled }) => {
  const [amount, setAmount] = useState("");
  const [expanded, setExpanded] = useState(false);
  const stakePercent =
    maxStake > 0 ? Math.min((validator.totalStake / maxStake) * 100, 100) : 0;

  const handleStake = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!isNaN(n) && n > 0) {
      onStake(n);
      setAmount("");
    }
  };

  // APR color tier
  const aprColor =
    validator.apr >= 15
      ? "text-cyan-400"
      : validator.apr >= 10
        ? "text-green-400"
        : validator.apr >= 5
          ? "text-yellow-400"
          : "text-slate-400";

  return (
    <div className="card-cyber bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Top bar accent */}
      <div className="h-0.5 w-full progress-shine" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">
              {validator.icon}
            </div>
            <div>
              <h3 className="font-bold text-white">{validator.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {validator.publicKey.slice(0, 16)}…
              </p>
            </div>
          </div>
          <span className={`text-xl font-black ${aprColor}`}>
            {validator.apr.toFixed(1)}%
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-0.5">Total Staked</p>
            <p className="text-sm font-bold text-white">
              {validator.totalStake >= 1_000_000
                ? `${(validator.totalStake / 1_000_000).toFixed(2)}M`
                : validator.totalStake.toLocaleString()}{" "}
              <span className="text-cyan-400">AN</span>
            </p>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-0.5">APR</p>
            <p className={`text-sm font-bold ${aprColor}`}>
              {validator.apr.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Stake bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Network share</span>
            <span>{stakePercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${stakePercent}%`,
                background: "linear-gradient(90deg, #06b6d4, #6366f1)",
              }}
            />
          </div>
        </div>

        {/* My stake */}
        {stakedAmount > 0 && (
          <div className="mb-4 flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
            <span className="text-xs text-cyan-400">◉ My stake:</span>
            <span className="text-sm font-bold text-white">
              {stakedAmount.toLocaleString()} AN
            </span>
          </div>
        )}

        {/* Stake form */}
        {!disabled && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors flex items-center justify-center gap-1"
          >
            {expanded ? "▴ Close" : "▾ Stake with this validator"}
          </button>
        )}

        {!disabled && expanded && (
          <form onSubmit={handleStake} className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                min="0"
                step="any"
                className="input-cyber w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400 pointer-events-none">
                AN
              </span>
            </div>
            <button
              type="submit"
              className="btn-cyber bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold px-4 rounded-xl transition-all text-sm"
            >
              Stake
            </button>
          </form>
        )}

        {disabled && (
          <p className="text-xs text-slate-600 text-center mt-2">
            Connect wallet to stake
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const StakingPage: React.FC<StakingPageProps> = ({
  wallet,
  validators,
  onStake,
  onClaimRewards,
}) => {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [claiming, setClaiming] = useState(false);

  const totalStaked = useMemo(
    () => wallet?.stakes.reduce((a, s) => a + s.amount, 0) || 0,
    [wallet?.stakes],
  );
  const totalRewards = useMemo(
    () => wallet?.stakes.reduce((a, s) => a + s.rewards, 0) || 0,
    [wallet?.stakes],
  );
  const maxValidatorStake = useMemo(
    () => Math.max(...validators.map((v) => v.totalStake), 1),
    [validators],
  );

  const handleStake = async (validatorAddress: string, amount: number) => {
    const result = await onStake(validatorAddress, amount);
    setMessage({ text: result.message, ok: result.success });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleClaim = async () => {
    setClaiming(true);
    await onClaimRewards();
    setClaiming(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Staking</h1>
        <p className="text-slate-500 text-sm mt-1">
          Delegate AN tokens to secure the network and earn yield rewards.
        </p>
      </div>

      {/* Toast message */}
      {message && (
        <div
          className={`mb-6 flex items-center gap-3 p-4 rounded-xl border text-sm ${
            message.ok
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          <span>{message.ok ? "✓" : "✗"}</span>
          {message.text}
        </div>
      )}

      {/* Summary banner */}
      {wallet ? (
        <div className="card-cyber bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-indigo-500/5 pointer-events-none" />
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Staked</p>
              <p className="text-3xl font-black text-white">
                {totalStaked.toLocaleString()}
              </p>
              <p className="text-sm text-cyan-400 font-semibold">AN</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Claimable Rewards</p>
              <p className="text-3xl font-black text-emerald-400">
                {totalRewards.toFixed(6)}
              </p>
              <p className="text-sm text-cyan-400 font-semibold">AN</p>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleClaim}
                disabled={totalRewards === 0 || claiming}
                className="btn-cyber w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3 px-8 rounded-full transition-all disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full" />{" "}
                    Claiming…
                  </>
                ) : (
                  "★ Claim All Rewards"
                )}
              </button>
            </div>
          </div>

          {/* Active positions */}
          {wallet.stakes.length > 0 && (
            <div className="relative mt-6 pt-6 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Your Positions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {wallet.stakes.map((s) => {
                  const v = validators.find(
                    (vv) => vv.publicKey === s.validatorAddress,
                  );
                  return (
                    <div
                      key={s.validatorAddress}
                      className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-3"
                    >
                      <span className="text-xl">{v?.icon || "◉"}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">
                          {v?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.amount.toLocaleString()} AN staked
                        </p>
                      </div>
                      {s.rewards > 0 && (
                        <span className="ml-auto text-xs font-bold text-green-400">
                          +{s.rewards.toFixed(4)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card-cyber bg-slate-900/80 border border-slate-800 border-dashed rounded-2xl p-8 mb-8 text-center">
          <p className="text-slate-500">
            Please create or load a wallet on the Wallet page to access staking.
          </p>
        </div>
      )}

      {/* Validator grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Validators</h2>
        <span className="text-sm text-slate-500">
          {validators.length} active
        </span>
      </div>

      {validators.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {validators.map((v) => {
            const myStake =
              wallet?.stakes.find((s) => s.validatorAddress === v.publicKey)
                ?.amount || 0;
            return (
              <ValidatorCard
                key={v.publicKey}
                validator={v}
                stakedAmount={myStake}
                maxStake={maxValidatorStake}
                onStake={(amount) => handleStake(v.publicKey, amount)}
                disabled={!wallet}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-slate-600">
          <p className="text-4xl mb-3">◉</p>
          <p>No validators available. Start the node to register validators.</p>
        </div>
      )}
    </div>
  );
};
