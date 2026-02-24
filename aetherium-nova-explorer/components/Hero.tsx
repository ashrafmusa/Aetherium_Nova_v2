import React, { useEffect, useRef } from "react";
import type { NetworkStatsData } from "../types";

interface HeroProps {
  stats?: NetworkStatsData | null;
  setPage?: (page: "home" | "network" | "wallet" | "staking" | "cli") => void;
  onOpenWhitepaper?: () => void;
}

// Particle class for canvas animation
const PARTICLE_COUNT = 40;

export const Hero: React.FC<HeroProps> = ({
  stats,
  setPage,
  onOpenWhitepaper,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Create particles
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 211, 238, ${p.alpha})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-slate-950">
        <div className="absolute inset-0 cyber-grid" />
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-slate-950" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Top badge */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Post-Quantum Blockchain · Now Live on Mainnet
          </span>
        </div>

        {/* Main heading */}
        <h1 className="animate-slide-in-up text-5xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-none mb-2">
          <span className="block text-white">Aetherium</span>
          <span className="block text-gradient-glow animate-glow">Nova</span>
        </h1>

        {/* Tagline */}
        <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 leading-relaxed animate-fade-in">
          The first blockchain engineered for the{" "}
          <span className="text-cyan-300 font-semibold">quantum era</span> —
          combining post-quantum cryptography, utility-driven consensus, and
          dynamic sharding to build an infrastructure that lasts{" "}
          <span className="text-white font-semibold">centuries</span>.
        </p>

        {/* Feature chips */}
        <div className="mt-6 flex flex-wrap justify-center gap-2 animate-fade-in">
          {[
            "PoSU Consensus",
            "CRYSTALS-Dilithium",
            "Dynamic Sharding",
            "ZK Proofs",
            "EVM Compatible",
          ].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-xs font-medium rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-400 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4 animate-slide-in-up">
          <button
            onClick={() => setPage?.("network")}
            className="btn-cyber group flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-4 px-8 rounded-full transition-all duration-300 shadow-glow-cyan hover:shadow-glow-cyan-lg"
          >
            <span>Explore Network</span>
            <svg
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
          <button
            onClick={() => onOpenWhitepaper?.()}
            className="btn-cyber flex items-center justify-center gap-2 border border-slate-600 hover:border-cyan-500/50 text-white font-semibold py-4 px-8 rounded-full transition-all duration-300 hover:bg-cyan-500/5"
          >
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>Read Whitepaper</span>
          </button>
          <button
            onClick={() => setPage?.("wallet")}
            className="btn-cyber flex items-center justify-center gap-2 border border-indigo-500/40 hover:border-indigo-400/70 text-indigo-300 font-semibold py-4 px-8 rounded-full transition-all duration-300 hover:bg-indigo-500/10"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <span>Launch Wallet</span>
          </button>
        </div>

        {/* Live stats ticker */}
        {stats && (
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
            {[
              {
                label: "Block Height",
                value: stats.blockHeight.toLocaleString(),
                icon: "◈",
                color: "text-cyan-400",
              },
              {
                label: "TPS (3s avg)",
                value: stats.tps.toLocaleString(),
                icon: "⚡",
                color: "text-yellow-400",
              },
              {
                label: "Active Nodes",
                value: stats.activeNodes.toLocaleString(),
                icon: "◉",
                color: "text-green-400",
              },
              {
                label: "Market Cap",
                value: `$${(stats.marketCap / 1e9).toFixed(1)}B`,
                icon: "◆",
                color: "text-indigo-400",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="card-cyber bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl p-4"
              >
                <p className={`text-xs ${s.color} font-medium mb-1`}>
                  {s.icon} {s.label}
                </p>
                <p className="text-2xl font-bold text-white tracking-tight">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-600 animate-float">
        <span className="text-xs">Scroll</span>
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </section>
  );
};
