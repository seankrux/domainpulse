"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Gauge,
  ShieldCheck,
  Bell,
  Globe,
  Clock,
  FileCsv,
  Swap,
} from "@phosphor-icons/react";

const features = [
  {
    icon: Gauge,
    title: "Uptime monitoring",
    desc: "Real-time HTTP/HTTPS checks with configurable intervals. Track response times and get latency history you can actually read.",
  },
  {
    icon: ShieldCheck,
    title: "SSL tracking",
    desc: "Certificate expiry monitoring with early warnings. Know weeks in advance, not when Chrome turns the padlock red.",
  },
  {
    icon: Bell,
    title: "Smart alerts",
    desc: "Browser notifications, Slack webhooks, Discord messages, and Web Audio alerts. Pick your channel, set your thresholds.",
  },
  {
    icon: Globe,
    title: "DNS inspection",
    desc: "A, AAAA, CNAME, MX, TXT — see every record at a glance. Catch misconfigurations before they cause downtime.",
  },
  {
    icon: Clock,
    title: "Expiry tracking",
    desc: "WHOIS-based domain expiration monitoring. Never accidentally let a domain lapse because you lost track.",
  },
  {
    icon: FileCsv,
    title: "Bulk import",
    desc: "Import hundreds of domains at once via CSV. Export data anytime. Your domain list is always portable.",
  },
  {
    icon: Swap,
    title: "Zero-setup auth",
    desc: "PBKDF2-protected local auth with JWT sessions. No third-party identity provider required — it just works.",
  },
];

export function SiteFeatures() {
  const reduce = useReducedMotion();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-emerald-500/3 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16 sm:mb-20">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-emerald-400 text-xs font-semibold tracking-[0.2em] uppercase mb-4"
          >
            Everything you need
          </motion.p>
          <motion.h2
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4"
          >
            Monitor everything in one place
          </motion.h2>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-zinc-400 text-base sm:text-lg max-w-[600px] mx-auto leading-relaxed"
          >
            Stop juggling separate tools for uptime, SSL, and DNS. DomainPulse brings it all into one clean dashboard.
          </motion.p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, i) => {
            const colSpan = i === features.length - 1 && features.length % 3 === 1 ? "lg:col-span-3 lg:max-w-[calc(33.333%-1rem)] lg:mx-auto w-full" : "";
            return (
              <motion.div
                key={feature.title}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`group relative p-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all duration-300 hover:border-emerald-500/20 ${colSpan}`}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
                    <feature.icon size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1.5">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
