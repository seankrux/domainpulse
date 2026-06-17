"use client";
import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Shield,
  Bell,
  Upload,
  BarChart3,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    label: "Uptime monitoring",
    desc: "Real-time HTTP/S checks with configurable intervals and latency tracking across global regions.",
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    border: "border-emerald-500/20",
  },
  {
    icon: Shield,
    label: "SSL tracking",
    desc: "Auto-detect certificate expiry, issuer changes, and protocol downgrades before they become incidents.",
    gradient: "from-indigo-500/20 via-indigo-500/5 to-transparent",
    border: "border-indigo-500/20",
  },
  {
    icon: Bell,
    label: "Instant alerts",
    desc: "Push notifications, Slack messages, Discord webhooks — you decide how to get notified when something fails.",
    gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
    border: "border-amber-500/20",
  },
  {
    icon: Upload,
    label: "Bulk import",
    desc: "Import dozens of domains at once via CSV. No manual entry for every single domain you manage.",
    gradient: "from-rose-500/20 via-rose-500/5 to-transparent",
    border: "border-rose-500/20",
  },
  {
    icon: BarChart3,
    label: "Response analytics",
    desc: "Historical response time charts, uptime percentage breakdowns, and trend visualization over time.",
    gradient: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    border: "border-cyan-500/20",
  },
  {
    icon: Globe,
    label: "WHOIS expiry",
    desc: "Track domain registration renewal dates alongside your SSL certs — never lose a domain again.",
    gradient: "from-violet-500/20 via-violet-500/5 to-transparent",
    border: "border-violet-500/20",
  },
];

export function FeaturesSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Section background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.015] blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="max-w-[560px] mb-16"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-none tracking-tighter text-white mb-4">
            Everything you need to{" "}
            <span className="text-emerald-400">sleep well</span>.
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed">
            One dashboard to monitor uptime, track SSL certs, check WHOIS
            records, and get alerted before problems escalate.
          </p>
        </motion.div>

        {/* Feature grid — Emil-style staggered entry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-800/40 rounded-2xl overflow-hidden border border-zinc-800/60">
          {features.map((feature, i) => (
            <motion.div
              key={feature.label}
              className="group relative p-6 sm:p-7 bg-zinc-950 cursor-default"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: 0.35,
                delay: reduce ? 0 : i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={reduce ? {} : { scale: 1.02, transition: { duration: 0.15 } }}
            >
              {/* Gradient overlay on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
              />
              <div className="relative z-10">
                <motion.div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${feature.border} bg-zinc-900/80 mb-4`}
                  whileHover={reduce ? {} : { scale: 1.12 }}
                  transition={{ type: "spring", stiffness: 350, damping: 15 }}
                >
                  <feature.icon size={18} className="text-zinc-300" />
                </motion.div>
                <h3 className="text-white font-semibold text-sm mb-1.5">
                  {feature.label}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
