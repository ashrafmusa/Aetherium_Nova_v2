import React, { useState } from "react";

type Page = "home" | "network" | "wallet" | "staking" | "cli";

interface HeaderProps {
  currentPage: string;
  setPage: (page: Page) => void;
  isSyncing: boolean;
  walletAddress?: string;
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⬡" },
  { id: "network", label: "Explorer", icon: "◈" },
  { id: "wallet", label: "Wallet", icon: "◇" },
  { id: "staking", label: "Staking", icon: "◉" },
  { id: "cli", label: "CLI", icon: "▸" },
];

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  setPage,
  isSyncing,
  walletAddress,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNav = (page: Page) => {
    setPage(page);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/10">
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => handleNav("home")}
            className="flex items-center gap-2 group flex-shrink-0"
          >
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-all duration-300" />
              <div className="absolute inset-0 rounded-lg border border-cyan-500/40 group-hover:border-cyan-400/70 transition-all duration-300" />
              <span className="relative text-lg font-black text-cyan-400 group-hover:text-cyan-300 transition-colors animate-flicker">
                ⬡
              </span>
            </div>
            <div className="hidden sm:block leading-none">
              <span className="block text-lg font-black tracking-tight text-white group-hover:text-cyan-100 transition-colors">
                Aetherium
              </span>
              <span className="block text-xs font-semibold tracking-[0.25em] text-cyan-400/80 uppercase">
                Nova
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 group ${
                  currentPage === item.id
                    ? "text-cyan-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {currentPage === item.id && (
                  <span className="absolute inset-0 rounded-md bg-cyan-500/10 border border-cyan-500/20" />
                )}
                <span
                  className={`relative text-xs ${currentPage === item.id ? "text-cyan-400" : "text-slate-600 group-hover:text-slate-400"}`}
                >
                  {item.icon}
                </span>
                <span className="relative">{item.label}</span>
                {currentPage === item.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                )}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Network status */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
                isSyncing
                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                  : "bg-green-500/10 border-green-500/30 text-green-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "bg-yellow-400 animate-pulse" : "bg-green-400"}`}
              />
              <span className="hidden sm:inline">
                {isSyncing ? "Syncing" : "Live"}
              </span>
            </div>

            {/* Wallet pill */}
            {walletAddress && (
              <button
                onClick={() => handleNav("wallet")}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all duration-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="font-mono">
                  {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                </span>
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex flex-col gap-1 p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              aria-label="Toggle menu"
            >
              <span
                className={`block w-5 h-0.5 bg-current transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`}
              />
              <span
                className={`block w-5 h-0.5 bg-current transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block w-5 h-0.5 bg-current transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md animate-slide-in-up">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPage === item.id
                    ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
                {currentPage === item.id && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </button>
            ))}
            {walletAddress && (
              <div className="mt-2 pt-2 border-t border-slate-800 px-4 py-2 text-xs text-slate-500 font-mono">
                Wallet: {walletAddress.slice(0, 10)}…{walletAddress.slice(-6)}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
