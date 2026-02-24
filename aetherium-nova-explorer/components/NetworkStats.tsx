import React, { useEffect, useRef, useState } from "react";
import type { NetworkStatsData } from "../types";

interface NetworkStatsProps {
  stats: NetworkStatsData;
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    if (start === target) return;

    const diff = target - start;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

const StatItem: React.FC<{
  label: string;
  value: string;
  rawValue: number;
  icon: string;
  accent: string;
  description: string;
  suffix?: string;
}> = ({ label, value, icon, accent, description }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`card-cyber relative group bg-slate-900/80 border border-slate-800 rounded-2xl p-6 overflow-hidden transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      {/* Background glow */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`}
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${accent}10 0%, transparent 70%)`,
        }}
      />

      {/* Top line accent */}
      <div
        className="absolute top-0 left-4 right-4 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
            Live
          </span>
        </div>
        <p className="text-3xl font-black text-white tracking-tight">{value}</p>
        <p className="text-sm font-semibold text-slate-400 mt-1">{label}</p>
        <p className="text-xs text-slate-600 mt-1">{description}</p>
      </div>
    </div>
  );
};

export const NetworkStats: React.FC<NetworkStatsProps> = ({ stats }) => {
  const animatedHeight = useCountUp(stats.blockHeight);
  const animatedTps = useCountUp(stats.tps);
  const animatedNodes = useCountUp(stats.activeNodes);

  const formatMarketCap = (mc: number) => {
    if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`;
    if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
    return `$${mc.toLocaleString()}`;
  };

  const statItems = [
    {
      label: "Block Height",
      value: animatedHeight.toLocaleString(),
      rawValue: stats.blockHeight,
      icon: "◈",
      accent: "#22d3ee",
      description: "Latest confirmed block",
    },
    {
      label: "Transactions / s",
      value: animatedTps.toLocaleString(),
      rawValue: stats.tps,
      icon: "⚡",
      accent: "#eab308",
      description: "3-second rolling average",
    },
    {
      label: "Active Nodes",
      value: animatedNodes.toLocaleString(),
      rawValue: stats.activeNodes,
      icon: "◉",
      accent: "#22c55e",
      description: "Globally distributed validators",
    },
    {
      label: "Market Cap",
      value: formatMarketCap(stats.marketCap),
      rawValue: stats.marketCap,
      icon: "◆",
      accent: "#818cf8",
      description: "Fully diluted valuation",
    },
  ];

  return (
    <section id="stats" className="py-24 px-4 sm:px-6 lg:px-8 relative">
      {/* Section background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Real-Time Network Metrics
          </span>
          <h2 className="text-3xl font-bold text-white">
            Live Chain Statistics
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {statItems.map((item) => (
            <StatItem key={item.label} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};
