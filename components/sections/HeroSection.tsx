"use client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Activity, Shield, Zap } from "lucide-react";

const dashboardRows = [
  {
    name: "myapp.com",
    meta: "42ms · 99.97% uptime",
    status: "healthy",
    statusColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
    dotShadow: "rgba(52,211,153,0.4)",
  },
  {
    name: "api.io",
    meta: "28ms · 99.99% uptime",
    status: "healthy",
    statusColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
    dotShadow: "rgba(52,211,153,0.4)",
  },
  {
    name: "old-site.com",
    meta: "SSL expires in 3 days",
    status: "critical",
    statusColor: "text-red-400",
    dotColor: "bg-red-400",
    dotShadow: "rgba(248,113,113,0.4)",
  },
];

export function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden pt-20">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/3 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-emerald-500/2 blur-[100px]" />
      </div>

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(16, 185, 129, 0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-16 items-center">
          {/* Left: Value prop */}
          <div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono uppercase tracking-widest mb-6">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={
                    reduce
                      ? {}
                      : { scale: [1, 1.3, 1] }
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                Domain monitoring
              </span>

              <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-none tracking-tighter text-white mb-5">
                Your domains{" "}
                <span className="text-emerald-400">always online</span>
                —or you&apos;ll know first.
              </h1>

              <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-[480px] mb-8">
                Real-time uptime checks, SSL expiry tracking, and instant
                alerts. Know about problems before your users do.
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap gap-3 mb-12"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <motion.a
                href={
                  typeof import.meta !== "undefined" &&
                  import.meta.env?.VITE_APP_URL
                    ? import.meta.env.VITE_APP_URL
                    : "http://localhost:3000"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg transition-colors duration-150 shadow-xl shadow-emerald-500/25"
                whileHover={reduce ? {} : { scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Start monitoring
                <motion.span
                  className="inline-flex"
                  animate={reduce ? {} : { x: [0, 3, 0] }}
                  transition={{
                    duration: 0.4,
                    repeat: Infinity,
                    repeatDelay: 4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <ArrowRight size={16} />
                </motion.span>
              </motion.a>
              <motion.a
                href="/about"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium rounded-lg transition-colors duration-150"
                whileHover={reduce ? {} : { scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                Learn more
              </motion.a>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              className="flex items-center gap-4"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.25,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="flex -space-x-2">
                {[
                  { initial: "S", color: "bg-emerald-500" },
                  { initial: "A", color: "bg-indigo-500" },
                  { initial: "M", color: "bg-amber-500" },
                ].map((user, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full ${user.color} flex items-center justify-center text-[11px] font-bold text-white border-2 border-zinc-950`}
                  >
                    {user.initial}
                  </div>
                ))}
              </div>
              <span className="text-zinc-500 text-sm leading-tight">
                Trusted by solo devs and{" "}
                <span className="text-zinc-300">small teams</span>
              </span>
            </motion.div>
          </div>

          {/* Right: Dashboard preview */}
          <motion.div
            className="relative hidden lg:block"
            initial={reduce ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
              {/* Card header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                </div>
                <span className="text-zinc-600 text-xs font-mono ml-2">
                  dashboard preview
                </span>
              </div>

              {/* Mock content */}
              <div className="p-4 sm:p-5 space-y-3">
                {dashboardRows.map((row, i) => (
                  <motion.div
                    key={row.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800"
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: 0.35 + i * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        className={`w-2 h-2 rounded-full ${row.dotColor}`}
                        animate={
                          row.status === "healthy" && !reduce
                            ? { boxShadow: [`0 0 4px ${row.dotShadow}`, `0 0 10px ${row.dotShadow}`, `0 0 4px ${row.dotShadow}`] }
                            : {}
                        }
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        style={{ boxShadow: row.status === "healthy" ? `0 0 8px ${row.dotShadow}` : "none" }}
                      />
                      <div>
                        <div className="text-white text-sm font-medium">
                          {row.name}
                        </div>
                        <div className="text-zinc-500 text-xs font-mono">
                          {row.meta}
                        </div>
                      </div>
                    </div>
                    <motion.div
                      className={`${row.statusColor} text-xs font-mono border px-2 py-0.5 rounded`}
                      style={{
                        borderColor: row.status === "healthy"
                          ? "rgba(52,211,153,0.2)"
                          : "rgba(248,113,113,0.2)",
                        backgroundColor: row.status === "healthy"
                          ? "rgba(52,211,153,0.05)"
                          : "rgba(248,113,113,0.05)",
                      }}
                      whileHover={reduce ? {} : { scale: 1.04 }}
                    >
                      {row.status}
                    </motion.div>
                  </motion.div>
                ))}

                {/* SSL bar */}
                <motion.div
                  className="p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/50"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.6 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={13} className="text-emerald-400" />
                    <span className="text-zinc-300 text-xs font-medium">
                      SSL summary
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-500"
                      initial={reduce ? false : { width: "0%" }}
                      animate={{ width: "78%" }}
                      transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-zinc-600 text-[11px]">14 valid</span>
                    <span className="text-zinc-600 text-[11px]">
                      2 expiring
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Floating stat badges */}
            <motion.div
              className="absolute -top-3 -right-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/30"
              initial={reduce ? false : { opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 18,
                delay: 0.5,
              }}
            >
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-emerald-400" />
                <span className="text-zinc-400 text-xs">All systems</span>
                <span className="text-emerald-400 text-xs font-mono font-bold">
                  normal
                </span>
              </div>
            </motion.div>

            <motion.div
              className="absolute -bottom-3 -left-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/30"
              initial={reduce ? false : { opacity: 0, scale: 0.85, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 18,
                delay: 0.65,
              }}
            >
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                <span className="text-zinc-400 text-xs">Avg response</span>
                <span className="text-white text-xs font-mono font-bold">
                  36ms
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
