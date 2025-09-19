
import React, { useState } from 'react';
import type { Wallet, Transaction } from '../types';

interface WalletPageProps {
  wallet: Wallet | null;
  createWallet: () => Promise<void>;
  transactions: Transaction[];
  setPage: (page: 'staking') => void;
  onSend: (recipient: string, amount: number) => Promise<{ success: boolean; message: string }>;
  mempool: Transaction[];
}

const TransactionRow: React.FC<{ tx: Transaction, walletAddress: string }> = ({ tx, walletAddress }) => {
    const isSent = tx.from === walletAddress;
    return (
        <tr className="border-b border-slate-700 hover:bg-slate-800/50">
            <td className="p-3 text-xs font-mono text-cyan-400">{tx.hash.substring(0, 12)}...</td>
            <td className="p-3 text-xs">{tx.type}</td>
            <td className={`p-3 text-sm font-bold ${isSent ? 'text-red-400' : 'text-green-400'}`}>
                {isSent ? '-' : '+'} {tx.amount.toFixed(4)} AN
            </td>
            <td className="p-3 text-xs text-slate-400 hidden sm:table-cell">{new Date(tx.timestamp).toLocaleString()}</td>
        </tr>
    );
};

export const WalletPage: React.FC<WalletPageProps> = ({ wallet, createWallet, transactions, setPage, onSend, mempool }) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const sendAmount = parseFloat(amount);
    if (isNaN(sendAmount) || sendAmount <= 0) {
        setMessage({ text: "Invalid amount.", type: 'error' });
        return;
    }
    const result = await onSend(recipient, sendAmount);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    if (result.success) {
        setRecipient('');
        setAmount('');
    }
  };

  if (!wallet) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center p-8 bg-slate-800/50 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">No Wallet Found</h2>
        <p className="text-slate-400 mb-6">Create a new wallet to start using Aetherium Nova.</p>
        <button onClick={createWallet} className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/20">
          Create New Wallet
        </button>
      </div>
    );
  }
  
  const pendingSentAmount = mempool
    .filter(tx => tx.from === wallet.publicKey && (tx.type === 'TRANSFER' || tx.type === 'STAKE'))
    .reduce((acc, tx) => acc + tx.amount, 0);

  const availableBalance = wallet.balance - pendingSentAmount;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">My Wallet</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
           {/* Balance Card */}
           <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
             <h3 className="text-lg font-semibold text-slate-400 mb-2">Total Balance</h3>
             <p className="text-4xl font-bold text-white">{wallet.balance.toFixed(4)} <span className="text-2xl text-cyan-400">AN</span></p>
             {pendingSentAmount > 0 && <p className="text-sm text-yellow-400 mt-2">Available: {availableBalance.toFixed(4)} AN</p>}
             <div className="mt-4 text-xs space-y-2">
                 <p className="text-slate-400">Address:</p>
                 <p className="font-mono break-all text-slate-300">{wallet.publicKey}</p>
             </div>
             <button onClick={() => setPage('staking')} className="mt-6 w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2 px-4 rounded-full transition-colors">
                Go to Staking
             </button>
           </div>
           {/* Send Card */}
           <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
             <h3 className="text-lg font-semibold text-white mb-4">Send AN</h3>
             <form onSubmit={handleSend} className="space-y-4">
               <div>
                 <label htmlFor="recipient" className="block text-sm font-medium text-slate-400">Recipient Address</label>
                 <input type="text" id="recipient" value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500" />
               </div>
               <div>
                 <label htmlFor="amount" className="block text-sm font-medium text-slate-400">Amount</label>
                 <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500" />
               </div>
               <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-2 px-4 rounded-full transition-colors">
                 Send
               </button>
             </form>
             {message && <p className={`mt-4 text-sm text-center ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>}
           </div>
        </div>
        <div className="lg:col-span-2">
            {/* Transactions Card */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="text-lg font-semibold text-white p-4 border-b border-slate-700">Transaction History</h3>
                <div className="max-h-[560px] overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-800">
                           <tr className="text-slate-400 text-sm">
                               <th className="p-3 font-semibold">Hash</th>
                               <th className="p-3 font-semibold">Type</th>
                               <th className="p-3 font-semibold">Amount</th>
                               <th className="p-3 font-semibold hidden sm:table-cell">Date</th>
                           </tr>
                        </thead>
                        <tbody>
                            {transactions.filter(tx => tx.from === wallet.publicKey || tx.to === wallet.publicKey).map(tx => (
                                <TransactionRow key={tx.hash} tx={tx} walletAddress={wallet.publicKey} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
