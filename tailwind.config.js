/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        zinc: {
          850: '#1c1c1f',
          950: '#09090b',
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 15px rgba(16, 185, 129, 0.3)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.25), 0 0 40px rgba(16, 185, 129, 0.1)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.25), 0 0 40px rgba(239, 68, 68, 0.1)',
      }
    },
  },
  plugins: [],
}
