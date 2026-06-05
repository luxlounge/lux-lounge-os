/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          light: '#E8C94A',
          dark: '#B8960A',
          muted: 'rgba(212,175,55,0.12)',
          glow: 'rgba(212,175,55,0.18)',
        },
        ink: {
          DEFAULT: '#0F0F0F',
          card: '#171717',
          raised: '#1C1C1C',
          border: '#262626',
          'border-2': '#2E2E2E',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 24px rgba(212,175,55,0.18)',
        'gold-sm': '0 0 12px rgba(212,175,55,0.12)',
      },
    },
  },
  plugins: [],
}
