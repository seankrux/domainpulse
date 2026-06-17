"use client";

import { motion, useReducedMotion } from "motion/react";
import { Gauge, ShieldCheck, Bell, Clock } from "@phosphor-icons/react";

const stats = [
  { icon: Gauge, value: "99.9%", label: "Dashboard uptime" },
  { icon: ShieldCheck, value: "30+", label: "Domains supported" },
  { icon: Bell, value: "4", label: "Alert channels" },
  { icon: Clock, value: "< 30s", label: "Detection time" },
];

export function SiteStats() {
  const reduce = useReducedMotion();

  return (
    <section className="relative py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="text-center"
              >
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <stat.icon size={20} weight="duotone" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
