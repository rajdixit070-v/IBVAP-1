/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        defense: {
          900: '#0b0f17',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
          500: '#4b5563',
          card: '#131c2e',
          border: '#22324d',
          accent: '#0284c7',
          highlight: '#38bdf8'
        },
        status: {
          healthy: '#10b981',
          degraded: '#f59e0b',
          offline: '#ef4444',
          error: '#dc2626',
          connecting: '#6366f1'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
