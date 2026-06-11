/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          vivid: '#E8C84A',
          dark: '#B8960A',
          muted: 'rgba(212,175,55,0.12)',
          glow: 'rgba(212,175,55,0.18)',
        },
        // Dark ink tokens (kept for compatibility)
        ink: {
          DEFAULT: '#080808',
          card: '#111111',
          raised: '#161616',
          border: '#242424',
          'border-2': '#333333',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        gold: '0 0 24px rgba(212,175,55,0.18)',
        'gold-sm': '0 0 12px rgba(212,175,55,0.10)',
        'gold-lg': '0 0 40px rgba(212,175,55,0.22), 0 0 12px rgba(212,175,55,0.12)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-dark': '0 2px 8px rgba(0,0,0,0.5)',
        modal: '0 20px 60px rgba(0,0,0,0.12)',
        'modal-dark': '0 20px 60px rgba(0,0,0,0.70)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 8px rgba(212,175,55,0.08), 0 0 0 1px rgba(212,175,55,0.30)' },
          '50%':      { boxShadow: '0 0 28px rgba(212,175,55,0.20), 0 0 0 1px rgba(212,175,55,0.50)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% center' },
          to:   { backgroundPosition:  '200% center' },
        },
      },
    },
  },
  plugins: [],
}
