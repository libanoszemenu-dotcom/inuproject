/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep academic blue (main) and warm gold (accent). Text on -700/-800/-900 passes WCAG AA with white.
        brand: {
          50: '#eef5fb', 100: '#d9e8f5', 200: '#b6d2ea', 300: '#86b3da', 400: '#548fc6',
          500: '#3171ae', 600: '#245a91', 700: '#1f4a76', 800: '#1d3f61', 900: '#16314d',
        },
        accent: { 50: '#fff8e6', 100: '#feefc2', 400: '#f2b630', 500: '#e19d12', 700: '#8f5a05' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans Ethiopic', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
