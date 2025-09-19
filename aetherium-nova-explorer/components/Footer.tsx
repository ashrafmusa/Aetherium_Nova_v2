
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900/50 border-t border-slate-300/10">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-slate-400">
        <p>&copy; {new Date().getFullYear()} Aetherium Nova. A Fictional Blockchain Simulation.</p>
        <p className="mt-2 text-sm">This project is for demonstrative purposes only.</p>
      </div>
    </footer>
  );
};
