import React from "react";

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  const links = {
    Protocol: [
      { label: "Whitepaper", href: "#" },
      { label: "Documentation", href: "#" },
      { label: "GitHub", href: "#" },
      { label: "Audit Reports", href: "#" },
    ],
    Network: [
      { label: "Explorer", href: "#" },
      { label: "Validators", href: "#" },
      { label: "Staking", href: "#" },
      { label: "Node Setup", href: "#" },
    ],
    Community: [
      { label: "Discord", href: "#" },
      { label: "Twitter / X", href: "#" },
      { label: "Telegram", href: "#" },
      { label: "Blog", href: "#" },
    ],
  };

  return (
    <footer className="relative bg-slate-950 border-t border-slate-800/80 mt-16">
      {/* Top gradient line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main footer grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black">
                ⬡
              </div>
              <div>
                <span className="text-base font-black text-white">
                  Aetherium
                </span>
                <span className="block text-xs font-semibold text-cyan-400/70 tracking-widest uppercase -mt-0.5">
                  Nova
                </span>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Next-generation post-quantum blockchain infrastructure for a
              decentralized future.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">
                Mainnet Live
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                {heading}
              </h4>
              <ul className="space-y-3">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-slate-500 hover:text-cyan-400 transition-colors duration-200"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-sm">
            © {year} Aetherium Nova Foundation. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <a href="#" className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-400 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-slate-400 transition-colors">
              Security
            </a>
            <span className="text-slate-700">v2.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
