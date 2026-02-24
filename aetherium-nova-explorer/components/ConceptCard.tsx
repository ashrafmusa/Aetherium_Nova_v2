import React, { useEffect, useRef, useState } from "react";
import type { Concept } from "../types";

export const ConceptCard: React.FC<Concept> = ({
  icon,
  title,
  description,
}) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`card-cyber group relative bg-slate-900/60 p-6 rounded-2xl border border-slate-800 overflow-hidden
        transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
    >
      {/* Corner glow */}
      <div
        className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl translate-x-8 -translate-y-8
        group-hover:bg-cyan-500/10 transition-all duration-500 pointer-events-none"
      />

      {/* Neon top border on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/0 to-transparent
        group-hover:via-cyan-500/50 transition-all duration-500"
      />

      <div className="relative">
        <div className="mb-5 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-2xl
            group-hover:border-cyan-500/40 group-hover:bg-cyan-500/10 transition-all duration-300"
          >
            {icon}
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-cyan-100 transition-colors">
            {title}
          </h3>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
          {description}
        </p>
      </div>
    </div>
  );
};
