
import React from 'react';

interface HeaderProps {
  currentPage: string;
  setPage: (page: 'home' | 'network' | 'wallet' | 'staking' | 'cli') => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, setPage, isSyncing }) => {
  const navItems = ['home', 'network', 'wallet', 'staking', 'cli'];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/70 backdrop-blur-sm border-b border-slate-300/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold text-white">
                A<span className="text-cyan-400">N</span>
              </span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <button
                    key={item}
                    onClick={() => setPage(item as any)}
                    className={`capitalize px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      currentPage === item
                        ? 'bg-cyan-500 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center">
             <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                <span className="text-sm text-slate-400">{isSyncing ? 'Syncing...' : 'Live'}</span>
             </div>
          </div>
        </div>
      </div>
    </header>
  );
};
