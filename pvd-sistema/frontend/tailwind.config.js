/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef2ec',
          100: '#fde1d1',
          200: '#fbc3a3',
          300: '#f89a69',
          400: '#f37235',
          500: '#E85D2F',
          600: '#C73E18',
          700: '#a12e12',
          800: '#7d2610',
          900: '#5e1d0c',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
