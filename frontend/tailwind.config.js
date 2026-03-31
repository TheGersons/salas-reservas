/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'blue-sm': '0 2px 8px rgba(37, 99, 235, 0.15)',
        'blue-md': '0 4px 16px rgba(37, 99, 235, 0.2)',
        'blue-lg': '0 8px 32px rgba(37, 99, 235, 0.25)',
      },
    },
  },
  plugins: [],
};
