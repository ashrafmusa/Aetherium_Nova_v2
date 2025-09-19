
import React from 'react';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-24 pb-20 sm:pt-32 sm:pb-28 lg:pt-40 lg:pb-32 text-center overflow-hidden">
        <div className="absolute inset-0 bg-slate-900">
            <div className="absolute inset-0 bg-grid-slate-800/[0.05] [mask-image:linear-gradient(0deg,transparent,black)]"></div>
        </div>
        <div className="relative z-10 px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
                Aetherium Nova
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-slate-400">
                The Quantum-Resistant, Utility-Driven Blockchain for a New Era of Decentralization.
            </p>
            <div className="mt-8 flex justify-center gap-4">
                <a href="#features" className="bg-white text-slate-900 font-semibold py-3 px-6 rounded-full hover:bg-slate-200 transition-colors duration-300">
                    Discover Features
                </a>
                <a href="#introduction" className="border border-slate-600 text-white font-semibold py-3 px-6 rounded-full hover:bg-slate-800 transition-colors duration-300">
                    Learn More
                </a>
            </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-900 to-transparent"></div>
    </section>
  );
};
