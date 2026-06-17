"use client";
import { motion, useReducedMotion } from "motion/react";
import { Search, Bell, ShieldCheck } from "lucide-react";

const steps = [
  {
    icon: Search,
    label: "Add domains",
    desc: "Import your domains one at a time or upload a CSV. DomainPulse starts monitoring within seconds.",
    highlight: "emerald",
  },
  {
    icon: Bell,
    label: "Set up alerts",
    desc: "Connect Slack, Discord, email, or enable push notifications. You pick the channel, we deliver the news.",
    highlight: "amber",
  },
  {
    icon: ShieldCheck,
    label: "Rest easy",
    desc: "We check every 5 minutes. If anything goes down, you hear about it before your users do.",
    highlight: "emerald",
  },
];

export function HowItWorksSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="max-w-[520px] mb-14"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-none tracking-tighter text-white mb-4">
            Three steps to{" "}
            <span className="text-emerald-400">peace of mind</span>.
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              className="relative"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.35,
                delay: reduce ? 0 : i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {/* Step number */}
              <motion.span
                className="text-[clamp(3rem,5vw,4.5rem)] font-bold text-zinc-800 leading-none block mb-4"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.15 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                viewport={{ once: true }}
              >
                {String(i + 1).padStart(2, "0")}
              </motion.span>
              <motion.div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border bg-zinc-900/80 mb-4 ${
                  step.highlight === "emerald"
                    ? "border-emerald-500/20"
                    : "border-amber-500/20"
                }`}
                whileHover={
                  reduce
                    ? {}
                    : { scale: 1.12, y: -2 }
                }
                transition={{ type: "spring", stiffness: 350, damping: 15 }}
              >
                <step.icon
                  size={18}
                  className={
                    step.highlight === "emerald"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                />
              </motion.div>
              <h3 className="text-white font-semibold text-base mb-1.5">
                {step.label}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
