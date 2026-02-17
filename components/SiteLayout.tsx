import React, { useState } from 'react';
import { Menu, X, Moon, Sun, Github, Mail, ArrowRight } from 'lucide-react';

interface SiteLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export const SiteLayout: React.FC<SiteLayoutProps> = ({ children, currentPage = 'home' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

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
    <div className={`min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              YourBrand
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map(item => (
                <a
                  key={item.slug}
                  href={`/${item.slug === 'home' ? '' : item.slug}`}
                  className={`text-sm font-medium transition-colors ${
                    currentPage === item.slug
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="http://localhost:3000"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                Launch App
                <ArrowRight size={16} />
              </a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleDarkMode}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <a
                href="https://github.com/yourusername"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Github size={20} />
              </a>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-slate-500 dark:text-slate-400"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <nav className="px-4 py-4 space-y-2">
              {navItems.map(item => (
                <a
                  key={item.slug}
                  href={`/${item.slug === 'home' ? '' : item.slug}`}
                  className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item.slug
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-4">
                YourBrand
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Building amazing things, one step at a time.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/about" className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">About</a></li>
                <li><a href="/blog" className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">Blog</a></li>
                <li><a href="/contact" className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <div className="flex items-center gap-4">
                <a href="https://github.com/yourusername" className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400">
                  <Github size={20} />
                </a>
                <a href="mailto:hello@example.com" className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400">
                  <Mail size={20} />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 mt-8 pt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} YourBrand. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
