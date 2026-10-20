/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: { 50: '#eef5fc', 100: '#d5e6f7', 200: '#a9cbee', 500: '#0a5cab', 600: '#004a90', 700: '#043078', 900: '#021a45' },
        coral: { 500: '#e86157', 600: '#d44c42' },
        amber: { 500: '#ff9800' },
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
