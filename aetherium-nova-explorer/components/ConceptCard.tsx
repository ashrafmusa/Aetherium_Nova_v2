
import React from 'react';
import type { Concept } from '../types';

export const ConceptCard: React.FC<Concept> = ({ icon, title, description }) => {
  return (
    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 hover:border-cyan-500 transition-colors duration-300 transform hover:-translate-y-1">
      <div className="flex items-center mb-4">
        <span className="p-3 rounded-full bg-slate-700/50 text-cyan-400 mr-4">
          {icon}
        </span>
        <h3 className="text-xl font-bold text-white">{title}</h3>
      </div>
      <p className="text-slate-400">{description}</p>
    </div>
  );
};
