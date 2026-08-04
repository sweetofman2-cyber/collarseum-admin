/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF4E9',
          100: '#FFE3C7',
          200: '#FFC98D',
          300: '#FFA94D',
          400: '#FA9433',
          500: '#F5841F',
          600: '#E06D0F',
          700: '#B8560C',
          800: '#8F4209',
          900: '#6B3207',
        },
        navy: {
          50: '#EEF1F5',
          100: '#D7DEE8',
          200: '#AEBCCE',
          300: '#8598B2',
          400: '#5C7195',
          500: '#3A4E6B',
          600: '#2A3B54',
          700: '#1E2C40',
          800: '#151F2E',
          900: '#0F1622',
        },
      },
    },
  },
  plugins: [],
}
