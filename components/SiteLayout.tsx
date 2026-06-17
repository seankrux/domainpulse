import { useState, useEffect, useCallback } from "react";
import { Menu, X, ArrowRight, Github, Mail } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface SiteLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export const SiteLayout: React.FC<SiteLayoutProps> = ({
  children,
  currentPage = "home",
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();

  const onScroll = useCallback(() => {
    setScrolled(window.scrollY > 40);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const navItems = [
    { slug: "home", label: "Home" },
    { slug: "about", label: "About" },
    { slug: "blog", label: "Blog" },
    { slug: "contact", label: "Contact" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? "bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/60 shadow-lg shadow-black/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">
            {/* Logo */}
            <motion.a
              href="/"
              className="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              DomainPulse
            </motion.a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <motion.a
                  key={item.slug}
                  href={`/${item.slug === "home" ? "" : item.slug}`}
                  className={`relative text-sm font-medium transition-colors duration-150 ${
                    currentPage === item.slug
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                >
                  {currentPage === item.slug && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-px bg-emerald-400"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    />
                  )}
                  {item.label}
                </motion.a>
              ))}
              <motion.a
                href={
                  typeof import.meta !== "undefined" &&
                  import.meta.env?.VITE_APP_URL
                    ? import.meta.env.VITE_APP_URL
                    : "http://localhost:3000"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm rounded-lg transition-colors duration-150 shadow-lg shadow-emerald-500/20"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
              >
                Launch dashboard
                <motion.span
                  className="inline-flex"
                  animate={
                    reduce
                      ? {}
                      : { x: [0, 3, 0] }
                  }
                  transition={{
                    duration: 0.4,
                    repeat: Infinity,
                    repeatDelay: 4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <ArrowRight size={15} />
                </motion.span>
              </motion.a>
            </nav>

            {/* Mobile controls */}
            <div className="flex items-center gap-3 md:hidden">
              <motion.a
                href={
                  typeof import.meta !== "undefined" &&
                  import.meta.env?.VITE_APP_URL
                    ? import.meta.env.VITE_APP_URL
                    : "http://localhost:3000"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs rounded-lg transition-colors duration-150"
                whileTap={{ scale: 0.95 }}
              >
                Launch
              </motion.a>
              <motion.button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-zinc-400 hover:text-white transition-colors duration-150 p-1"
                aria-label="Toggle menu"
                whileTap={{ scale: 0.9 }}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl overflow-hidden"
            >
              <nav className="px-4 py-4 space-y-1">
                {navItems.map((item) => (
                  <motion.a
                    key={item.slug}
                    href={`/${item.slug === "home" ? "" : item.slug}`}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                      currentPage === item.slug
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    whileTap={{ scale: 0.97 }}
                  >
                    {item.label}
                  </motion.a>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <h3 className="text-lg font-bold text-emerald-400 mb-3">
                DomainPulse
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-[260px]">
                Professional domain monitoring and SSL tracking.
              </p>
            </motion.div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.35,
                delay: 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <h4 className="font-semibold text-sm text-zinc-300 mb-3 uppercase tracking-wider">
                Quick Links
              </h4>
              <ul className="space-y-2 text-sm">
                {["About", "Blog", "Contact"].map((label) => (
                  <li key={label}>
                    <motion.a
                      href={`/${label.toLowerCase()}`}
                      className="inline-block text-zinc-500 hover:text-emerald-400 transition-colors duration-150"
                      whileHover={{ x: 3 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      {label}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.35,
                delay: 0.16,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <h4 className="font-semibold text-sm text-zinc-300 mb-3 uppercase tracking-wider">
                Connect
              </h4>
              <div className="flex items-center gap-4">
                <motion.a
                  href="https://github.com/seankrux"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-emerald-400 transition-colors duration-150"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                >
                  <Github size={20} />
                </motion.a>
                <motion.a
                  href="mailto:contact@domainpulse.app"
                  className="text-zinc-500 hover:text-emerald-400 transition-colors duration-150"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                >
                  <Mail size={20} />
                </motion.a>
              </div>
            </motion.div>
          </div>
          <div className="border-t border-zinc-800/60 mt-8 pt-8 text-center text-sm text-zinc-600">
            &copy; {new Date().getFullYear()} DomainPulse. Made with care by Sean
            G.
          </div>
        </div>
      </footer>
    </div>
  );
};
