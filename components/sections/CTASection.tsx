"use client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-zinc-900 to-zinc-950 overflow-hidden text-center"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 px-6 py-16 sm:px-12 sm:py-20">
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-bold leading-none tracking-tighter text-white mb-4 max-w-[600px] mx-auto">
              Start monitoring your domains{" "}
              <span className="text-emerald-400">in seconds</span>.
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed max-w-[480px] mx-auto mb-8">
              No credit card. No onboarding calls. Just add your domains and
              we&apos;ll keep you informed.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <motion.a
                href={
                  typeof import.meta !== "undefined" &&
                  import.meta.env?.VITE_APP_URL
                    ? import.meta.env.VITE_APP_URL
                    : "http://localhost:3000"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg transition-colors duration-150 shadow-xl shadow-emerald-500/25"
                whileHover={reduce ? {} : { scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Get started free
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
                  <ArrowRight size={17} />
                </motion.span>
              </motion.a>
              <motion.a
                href="/about"
                className="inline-flex items-center gap-2 px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium rounded-lg transition-colors duration-150"
                whileHover={reduce ? {} : { scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                Learn more
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
