"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Shield, Pulse, Bell, Globe } from "@phosphor-icons/react";

const floatingIcons = [
  { Icon: Shield, x: "15%", y: "20%", delay: 0 },
  { Icon: Pulse, x: "80%", y: "15%", delay: 0.8 },
  { Icon: Bell, x: "85%", y: "70%", delay: 1.6 },
  { Icon: Globe, x: "10%", y: "75%", delay: 2.4 },
];

export function SiteHero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden pt-24">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-400/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-emerald-600/5 rounded-full blur-[80px]" />
      </div>

      {/* Floating icons - decorative */}
      {!reduce && (
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
          {floatingIcons.map(({ Icon, x, y, delay }) => (
            <motion.div
              key={delay}
              className="absolute text-emerald-500/20"
              style={{ left: x, top: y }}
              animate={{
                y: [0, -12, 0],
                opacity: [0.15, 0.3, 0.15],
              }}
              transition={{
                duration: 4,
                delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Icon size={28} weight="duotone" />
            </motion.div>
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot-green" />
                Real-time monitoring
              </span>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6">
                Never miss a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
                  domain issue
                </span>{" "}
                again.
              </h1>

              <p className="text-base sm:text-lg text-zinc-400 max-w-[520px] mx-auto lg:mx-0 leading-relaxed mb-8">
                Track uptime, SSL certificates, and DNS records across all your domains in one beautiful dashboard. Get alerts before problems become outages.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <a
                  href={import.meta.env.VITE_APP_URL ?? "http://localhost:3000"}
                  className="group relative inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98]"
                >
                  Launch dashboard
                  <ArrowRight
                    size={18}
                    weight="bold"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </a>
                <a
                  href="/about"
                  className="inline-flex items-center gap-2 px-6 py-3 text-zinc-300 hover:text-white font-medium rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all duration-300 active:scale-[0.98]"
                >
                  Learn more
                </a>
              </div>
            </motion.div>
          </div>

          {/* Right: Visual Dashboard Preview */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 w-full max-w-[540px] lg:max-w-none"
          >
            <div className="relative">
              {/* Glow behind preview */}
              <div className="absolute -inset-4 bg-emerald-500/5 rounded-3xl blur-2xl" />

              <div className="relative glass-card rounded-2xl p-4 sm:p-6 overflow-hidden">
                {/* Mini dashboard mock UI */}
                <div className="space-y-3">
                  {/* Status bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 status-dot-green" />
                      <span className="text-xs text-zinc-400 font-medium">All systems monitored</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">12 domains</span>
                  </div>

                  {/* Rows */}
                  {[
                    { name: "example.com", status: "up", latency: "42ms", cert: "87d" },
                    { name: "api.example.com", status: "up", latency: "28ms", cert: "156d" },
                    { name: "app.example.io", status: "up", latency: "63ms", cert: "23d" },
                    { name: "admin.example.com", status: "warning", latency: "210ms", cert: "5d" },
                  ].map((row, i) => (
                    <motion.div
                      key={row.name}
                      initial={reduce ? false : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            row.status === "up"
                              ? "bg-emerald-400 status-dot-green"
                              : "bg-amber-400 status-dot-red"
                          }`}
                        />
                        <span className="text-sm font-medium text-zinc-200">{row.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-zinc-500 font-mono">{row.latency}</span>
                        <span
                          className={`font-mono ${
                            row.cert && parseInt(row.cert) < 30
                              ? "text-amber-400"
                              : "text-zinc-500"
                          }`}
                        >
                          SSL: {row.cert}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
