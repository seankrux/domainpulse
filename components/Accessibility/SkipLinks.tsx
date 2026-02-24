import React from 'react';

export const SkipLinks: React.FC = () => {
  return (
    <nav aria-label="Skip links" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100]">
      <ul className="flex flex-col gap-2">
        <li>
          <a
            href="#main-content"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-lg"
          >
            Skip to main content
          </a>
        </li>
        <li>
          <a
            href="#domain-table"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-lg"
          >
            Skip to domain table
          </a>
        </li>
        <li>
          <a
            href="#filters"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-lg"
          >
            Skip to filters
          </a>
        </li>
      </ul>
    </nav>
  );
};
