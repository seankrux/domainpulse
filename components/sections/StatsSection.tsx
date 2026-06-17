"use client";
import { motion, useReducedMotion } from "motion/react";
import { Activity, Shield, Bell, Clock } from "lucide-react";

const stats = [
  { label: "Domains monitored", value: "2,400+", icon: Activity },
  { label: "SSL certs tracked", value: "1,800+", icon: Shield },
  { label: "Alerts sent", value: "12,500+", icon: Bell },
  { label: "Avg response", value: "<40ms", icon: Clock },
];

export function StatsSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
          {/* Inner glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/3 blur-[100px] pointer-events-none" />

          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 divide-x divide-zinc-800">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="flex flex-col items-center justify-center p-6 sm:p-8 text-center"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.35,
                  delay: reduce ? 0 : i * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <motion.div
                  className="mb-3"
                  whileHover={reduce ? {} : { scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 300, damping: 12 }}
                >
                  <stat.icon size={18} className="text-emerald-400" />
                </motion.div>
                <motion.span
                  className="text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-none text-white tracking-tight mb-1"
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.25 + i * 0.06 }}
                  viewport={{ once: true }}
                >
                  {stat.value}
                </motion.span>
                <span className="text-zinc-500 text-sm">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
