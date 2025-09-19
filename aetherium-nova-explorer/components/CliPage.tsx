
import React, { useState, useRef, useEffect } from 'react';
import type { CliOutput } from '../types';

interface CliPageProps {
  history: CliOutput[];
  onCommand: (command: string) => void;
}

const getLineColor = (type: CliOutput['type']) => {
    switch(type) {
        case 'input': return 'text-cyan-400';
        case 'output': return 'text-slate-300';
        case 'error': return 'text-red-400';
        case 'success': return 'text-green-400';
        case 'info': return 'text-yellow-400';
        default: return 'text-white';
    }
}

export const CliPage: React.FC<CliPageProps> = ({ history, onCommand }) => {
  const [input, setInput] = useState('');
  const endOfHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onCommand(input.trim());
      setInput('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-black/50 border border-slate-700 rounded-lg h-[70vh] flex flex-col font-mono text-sm">
        <div className="flex-grow p-4 overflow-y-auto">
          {history.map((line, index) => (
            <p key={index} className={`${getLineColor(line.type)} whitespace-pre-wrap break-words`}>
              {line.text}
            </p>
          ))}
          <div ref={endOfHistoryRef} />
        </div>
        <form onSubmit={handleCommand} className="flex border-t border-slate-700">
          <span className="pl-4 pr-2 py-2 text-cyan-400">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-transparent text-white focus:outline-none py-2"
            placeholder="Type a command..."
            autoFocus
          />
        </form>
      </div>
    </div>
  );
};
