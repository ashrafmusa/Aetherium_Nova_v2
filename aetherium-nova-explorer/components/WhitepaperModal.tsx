
import React, { Fragment } from 'react';

interface WhitepaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhitepaperModal: React.FC<WhitepaperModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-800/80 backdrop-blur-sm p-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Aetherium Nova Whitepaper (Abstract)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        <div className="p-8 text-slate-300 space-y-4">
          <h3 className="text-xl font-semibold text-cyan-400">1. Introduction</h3>
          <p>Aetherium Nova is a decentralized, open-source blockchain platform designed to address the trilemma of security, scalability, and decentralization. By introducing a novel hybrid consensus mechanism, Post-Quantum Utility (PoSU), and a dynamically sharded state architecture, Aetherium Nova provides a robust foundation for next-generation decentralized applications (dApps) and secure value transfer in the quantum computing era.</p>
          <h3 className="text-xl font-semibold text-cyan-400">2. Post-Quantum Cryptography</h3>
          <p>Recognizing the future threat posed by quantum computers to current cryptographic standards (e.g., ECDSA), Aetherium Nova integrates CRYSTALS-Dilithium for digital signatures. This ensures that all transactions and network communications remain secure against attacks from both classical and quantum adversaries, guaranteeing long-term asset security.</p>
          <h3 className="text-xl font-semibold text-cyan-400">3. Hybrid Consensus: Proof-of-Stake & Utility (PoSU)</h3>
          <p>PoSU extends traditional Proof-of-Stake (PoS) by incorporating a 'utility' component. Validators are rewarded not only for proposing and attesting to blocks but also for providing verifiable, useful computation to the network. This creates a dual-incentive model, securing the network while simultaneously creating a decentralized market for computational resources, such as AI model training, scientific simulations, or complex rendering tasks.</p>
          <h3 className="text-xl font-semibold text-cyan-400">4. Network Architecture</h3>
          <p>The network employs Dynamic State Sharding to achieve high throughput and low latency. The global state is partitioned into multiple shards, each processing transactions in parallel. A beacon chain coordinates these shards and maintains the integrity of the overall network. This design allows the network to scale horizontally by adding more shards as demand increases, preventing the 'blockchain bloat' that plagues monolithic chains.</p>
        </div>
      </div>
    </div>
  );
};
