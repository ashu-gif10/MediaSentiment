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
        dark: {
          bg: '#0a0d14',
          surface: '#111625',
          card: '#161d31',
          border: '#1f2942',
          muted: '#8e9bbb'
        },
        brand: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          cyan: '#06b6d4'
        }
      }
    },
  },
  plugins: [],
}

