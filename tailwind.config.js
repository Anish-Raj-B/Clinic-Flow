/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#dbeefe',
          200: '#bfe2fe',
          300: '#92d0fd',
          400: '#5eb5fa',
          500: '#3897f6',
          600: '#2278eb',
          700: '#1a61d8',
          800: '#1b50af',
          900: '#1c458a',
        },
        accent: {
          50: '#ecfdf8',
          100: '#d0faee',
          200: '#a3f4de',
          300: '#69e7ca',
          400: '#34d1b1',
          500: '#14b596',
          600: '#0a927a',
          700: '#0b7564',
          800: '#0d5d51',
          900: '#0e4d44',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 16px -6px rgba(16, 24, 40, 0.12)',
      },
    },
  },
  plugins: [],
};
