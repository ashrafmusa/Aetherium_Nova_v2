
import React from 'react';
import type { NetworkStatsData } from '../types';

interface NetworkStatsProps {
  stats: NetworkStatsData;
}

const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="text-center bg-slate-800/30 p-4 rounded-lg border border-slate-700">
        <p className="text-sm text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
);

export const NetworkStats: React.FC<NetworkStatsProps> = ({ stats }) => {
    const formatMarketCap = (mc: number) => {
        if (mc > 1_000_000_000) {
            return `$${(mc / 1_000_000_000).toFixed(2)}B`;
        }
        return `$${(mc / 1_000_000).toFixed(2)}M`;
    }

    return (
        <section id="stats" className="py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    <StatItem label="Block Height" value={stats.blockHeight.toLocaleString()} />
                    <StatItem label="TPS (3s)" value={stats.tps.toLocaleString()} />
                    <StatItem label="Active Nodes" value={stats.activeNodes.toLocaleString()} />
                    <StatItem label="Market Cap" value={formatMarketCap(stats.marketCap)} />
                </div>
            </div>
        </section>
    );
};
