
import React, { useState } from 'react';
import type { Block, Transaction, NetworkStatsData } from '../types';

interface NetworkExplorerProps {
  stats: NetworkStatsData;
  transactions: Transaction[];
  mempool: Transaction[];
  blocks: Block[];
}

const DataCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        <h3 className="text-lg font-bold text-white p-4 bg-slate-800 border-b border-slate-700">{title}</h3>
        <div className="p-4">{children}</div>
    </div>
);

const TransactionItem: React.FC<{ tx: Transaction, isMempool?: boolean }> = ({ tx, isMempool = false }) => (
    <div className="text-xs font-mono p-2 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/30">
        <p className="truncate text-cyan-400">Hash: {tx.hash}</p>
        <p>From: <span className="text-slate-400">{tx.from.substring(0, 20)}...</span></p>
        <p>To: <span className="text-slate-400">{tx.to.substring(0, 20)}...</span></p>
        <div className="flex justify-between items-center">
            <p>Amount: <span className="font-bold text-white">{tx.amount.toFixed(4)} AN</span></p>
            <span className={`px-2 py-0.5 rounded-full text-xs ${isMempool ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>{tx.type}</span>
        </div>
    </div>
);

const BlockItem: React.FC<{ block: Block }> = ({ block }) => (
    <div className="text-xs font-mono p-2 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/30">
        <p>Block: <span className="text-cyan-400 font-bold">{block.index.toLocaleString()}</span></p>
        <p className="truncate">Hash: <span className="text-slate-400">{block.hash}</span></p>
        <div className="flex justify-between items-center">
            <p>Txs: <span className="text-white">{block.transactions.length}</span></p>
            <p>{new Date(block.timestamp).toLocaleTimeString()}</p>
        </div>
    </div>
);


export const NetworkExplorer: React.FC<NetworkExplorerProps> = ({ stats, transactions, mempool, blocks }) => {
  const [filterType, setFilterType] = useState<'ALL' | Transaction['type']>('ALL');

  const filterTypes: Array<'ALL' | Transaction['type']> = ['ALL', 'TRANSFER', 'STAKE', 'REWARD'];

  const filteredMempool = mempool.filter(tx => 
      filterType === 'ALL' || tx.type === filterType
  );

  const filteredTransactions = transactions.filter(tx => 
      filterType === 'ALL' || tx.type === filterType
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-4 sm:mb-0">Network Explorer</h1>
            <div className="flex items-center space-x-2 bg-slate-800/50 border border-slate-700 rounded-full p-1">
                {filterTypes.map(type => (
                    <button 
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 capitalize ${
                            filterType === type 
                                ? 'bg-cyan-500 text-white' 
                                : 'text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        {type.toLowerCase()}
                    </button>
                ))}
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                 <DataCard title={`Mempool (${filteredMempool.length})`}>
                    <div className="max-h-96 overflow-y-auto">
                        {filteredMempool.length > 0 ? (
                            filteredMempool.map(tx => <TransactionItem key={tx.hash} tx={tx} isMempool={true} />)
                        ) : (
                             <p className="text-slate-400 text-sm p-2">{filterType === 'ALL' ? 'Mempool is empty.' : `No ${filterType} transactions in mempool.`}</p>
                        )}
                    </div>
                 </DataCard>
                 <DataCard title="Latest Blocks">
                    <div className="max-h-96 overflow-y-auto">
                        {blocks.map(block => <BlockItem key={block.hash} block={block} />)}
                    </div>
                </DataCard>
            </div>
            <div className="lg:col-span-2">
                 <DataCard title={`Confirmed Transactions (${filteredTransactions.length})`}>
                    <div className="max-h-[824px] overflow-y-auto">
                         {filteredTransactions.length > 0 ? (
                            filteredTransactions.map(tx => <TransactionItem key={tx.hash} tx={tx} />)
                         ) : (
                             <p className="text-slate-400 text-sm p-2">{filterType === 'ALL' ? 'No confirmed transactions.' : `No confirmed ${filterType} transactions found.`}</p>
                         )}
                    </div>
                </DataCard>
            </div>
        </div>
    </div>
  );
};
