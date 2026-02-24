import React from "react";

interface WhitepaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const sections = [
  {
    num: "01",
    title: "Introduction",
    content:
      "Aetherium Nova is a decentralized, open-source blockchain platform designed to address the trilemma of security, scalability, and decentralization. By introducing a novel hybrid consensus mechanism, Post-Quantum Utility (PoSU), and a dynamically sharded state architecture, Aetherium Nova provides a robust foundation for next-generation decentralized applications (dApps) and secure value transfer in the quantum computing era.",
  },
  {
    num: "02",
    title: "Post-Quantum Cryptography",
    content:
      "Recognizing the future threat posed by quantum computers to current cryptographic standards (e.g., ECDSA), Aetherium Nova integrates CRYSTALS-Dilithium for digital signatures. This ensures that all transactions and network communications remain secure against attacks from both classical and quantum adversaries, guaranteeing long-term asset security.",
  },
  {
    num: "03",
    title: "Hybrid Consensus: Proof-of-Stake & Utility (PoSU)",
    content:
      'PoSU extends traditional Proof-of-Stake (PoS) by incorporating a "utility" component. Validators are rewarded not only for proposing and attesting to blocks but also for providing verifiable, useful computation to the network. This creates a dual-incentive model, securing the network while simultaneously creating a decentralized market for computational resources.',
  },
  {
    num: "04",
    title: "Network Architecture",
    content:
      "The network employs Dynamic State Sharding to achieve high throughput and low latency. The global state is partitioned into multiple shards, each processing transactions in parallel. A beacon chain coordinates these shards and maintains the integrity of the overall network, allowing it to scale horizontally by adding more shards as demand increases.",
  },
  {
    num: "05",
    title: "Zero-Knowledge Privacy Layer",
    content:
      "Aetherium Nova leverages Zero-Knowledge Proofs (ZKPs) to offer optional, fully private transactions. Users can shield transaction data without compromising network integrity or auditability. This cryptographic layer ensures compliance-ready selective disclosure while preserving the core principle of financial sovereignty.",
  },
  {
    num: "06",
    title: "Tokenomics & Incentive Design",
    content:
      "The AN token powers all network operations. A deflationary burn mechanism, combined with PoSU staking rewards, creates long-term value alignment between validators, users, and the ecosystem. Block rewards taper over a 30-year schedule, mirroring Bitcoin's emission model while adding utility-driven emission boosts during high-demand periods.",
  },
];

export const WhitepaperModal: React.FC<WhitepaperModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl shadow-black/70 w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700/80 flex flex-col animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
              Technical Document
            </p>
            <h2 className="text-xl font-black text-white">
              Aetherium Nova Whitepaper
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
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

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-8">
          {sections.map(({ num, title, content }) => (
            <div key={num} className="group">
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black">
                  {num}
                </span>
                <div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-100 transition-colors">
                    {title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {content}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* CTA */}
          <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20">
            <p className="text-sm text-slate-300 font-medium">
              Join the Aetherium Nova network
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Stake AN to become a validator, contribute to network security,
              and earn rewards.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-950/40">
          <p className="text-xs text-slate-600">
            Aetherium Nova Foundation · v2.0
          </p>
          <button
            onClick={onClose}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-semibold"
          >
            Close ×
          </button>
        </div>
      </div>
    </div>
  );
};
