
import React, { useState, useMemo } from 'react';
import type { Wallet, Validator } from '../types';

interface StakingPageProps {
    wallet: Wallet | null;
    validators: Omit<Validator, 'secretKey'>[];
    onStake: (validatorAddress: string, amount: number) => Promise<{ success: boolean; message: string }>;
    onClaimRewards: () => Promise<void>;
}

const ValidatorCard: React.FC<{ validator: Omit<Validator, 'secretKey'>, onStake: (amount: number) => void }> = ({ validator, onStake }) => {
    const [amount, setAmount] = useState('');
    
    const handleStake = (e: React.FormEvent) => {
        e.preventDefault();
        const stakeAmount = parseFloat(amount);
        if(!isNaN(stakeAmount) && stakeAmount > 0) {
            onStake(stakeAmount);
            setAmount('');
        }
    }

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
            <div>
                <div className="flex items-center mb-3">
                    <span className="p-2 rounded-full bg-slate-700 text-cyan-400 mr-3">{validator.icon}</span>
                    <h3 className="font-bold text-white text-lg">{validator.name}</h3>
                </div>
                <p className="text-xs font-mono break-all text-slate-500 mb-3">{validator.publicKey}</p>
                <div className="flex justify-between text-sm mb-4">
                    <span className="text-slate-400">Total Stake:</span>
                    <span className="font-bold text-white">{(validator.totalStake / 1_000_000).toFixed(2)}M AN</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">APR:</span>
                    <span className="font-bold text-green-400">{validator.apr.toFixed(2)}%</span>
                </div>
            </div>
            <form onSubmit={handleStake} className="mt-4 flex gap-2">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500" />
                <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold px-4 rounded-md transition-colors">Stake</button>
            </form>
        </div>
    );
}

export const StakingPage: React.FC<StakingPageProps> = ({ wallet, validators, onStake, onClaimRewards }) => {
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleStakeAction = async (validatorAddress: string, amount: number) => {
        const result = await onStake(validatorAddress, amount);
        setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
        setTimeout(() => setMessage(null), 3000);
    };

    const totalStaked = useMemo(() => wallet?.stakes.reduce((acc, s) => acc + s.amount, 0) || 0, [wallet?.stakes]);
    const totalRewards = useMemo(() => wallet?.stakes.reduce((acc, s) => acc + s.rewards, 0) || 0, [wallet?.stakes]);

    if (!wallet) {
        return <div className="text-center mt-20 text-slate-400">Please create a wallet to access staking.</div>;
    }
    
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Staking</h1>
            <p className="text-slate-400 mb-6">Stake your AN tokens to secure the network and earn rewards.</p>
            
            {message && <p className={`mb-4 text-sm text-center p-2 rounded-md ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{message.text}</p>}

            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-center sm:text-left">
                    <h2 className="text-lg font-semibold text-slate-400">Your Staking Summary</h2>
                    <p className="text-3xl font-bold text-white mt-1">{totalStaked.toFixed(4)} <span className="text-2xl text-cyan-400">AN</span></p>
                    <p className="text-sm text-slate-400">Total Staked</p>
                </div>
                 <div className="text-center sm:text-left">
                    <p className="text-3xl font-bold text-green-400">{totalRewards.toFixed(6)} <span className="text-2xl text-cyan-400">AN</span></p>
                    <p className="text-sm text-slate-400">Claimable Rewards</p>
                </div>
                <button onClick={onClaimRewards} disabled={totalRewards === 0} className="bg-green-500 text-white font-bold py-3 px-8 rounded-full transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-green-400">
                    Claim All Rewards
                </button>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4">Validators</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {validators.map(v => (
                    <ValidatorCard key={v.publicKey} validator={v} onStake={(amount) => handleStakeAction(v.publicKey, amount)} />
                ))}
            </div>
        </div>
    );
}
