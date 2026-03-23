import React, { useState } from 'react';
import { Menu, X, Moon, Sun, Github, Mail, ArrowRight } from 'lucide-react';

interface SiteLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export const SiteLayout: React.FC<SiteLayoutProps> = ({ children, currentPage = 'home' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const navItems = [
    { slug: 'home', label: 'Home' },
    { slug: 'about', label: 'About' },
    { slug: 'blog', label: 'Blog' },
    { slug: 'contact', label: 'Contact' }
  ];

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className={`min-h-screen bg-zinc-950 text-zinc-100 transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-100`}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="text-xl font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
              DomainPulse
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map(item => (
                <a
                  key={item.slug}
                  href={`/${item.slug === 'home' ? '' : item.slug}`}
                  className={`text-sm font-medium transition-colors ${
                    currentPage === item.slug
                      ? 'text-emerald-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              ))}
              <a
                href={typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL ? import.meta.env.VITE_APP_URL : 'http://localhost:3000'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                Launch App
                <ArrowRight size={16} />
              </a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleDarkMode}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <a
                href="https://github.com/seankrux"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <Github size={20} />
              </a>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-zinc-500"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl">
            <nav className="px-4 py-4 space-y-2">
              {navItems.map(item => (
                <a
                  key={item.slug}
                  href={`/${item.slug === 'home' ? '' : item.slug}`}
                  className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item.slug
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold text-emerald-400 mb-4">
                DomainPulse
              </h3>
              <p className="text-zinc-400 text-sm">
                Professional domain monitoring and SSL tracking.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-zinc-200">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/about" className="text-zinc-400 hover:text-emerald-400 transition-colors">About</a></li>
                <li><a href="/blog" className="text-zinc-400 hover:text-emerald-400 transition-colors">Blog</a></li>
                <li><a href="/contact" className="text-zinc-400 hover:text-emerald-400 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-zinc-200">Connect</h4>
              <div className="flex items-center gap-4">
                <a href="https://github.com/seankrux" className="text-zinc-500 hover:text-emerald-400 transition-colors">
                  <Github size={20} />
                </a>
                <a href="mailto:contact@domainpulse.app" className="text-zinc-500 hover:text-emerald-400 transition-colors">
                  <Mail size={20} />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-800 mt-8 pt-8 text-center text-sm text-zinc-500">
            Made with care by Sean G
          </div>
        </div>
      </footer>
    </div>
  );
};
