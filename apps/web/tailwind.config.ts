import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // App canvas + glass system
        ink: {
          950: '#070b16',
          900: '#0b1121',
          800: '#111a30',
          700: '#1a2542',
        },
        accent: {
          DEFAULT: '#34d399',
          soft: '#6ee7b7',
          deep: '#0d9668',
        },
        // Validated dark-mode chart palette (dataviz slots 1–8)
        series: {
          1: '#3987e5',
          2: '#008300',
          3: '#d55181',
          4: '#c98500',
          5: '#199e70',
          6: '#d95926',
          7: '#9085e9',
          8: '#e66767',
        },
        status: {
          good: '#0ca30c',
          warning: '#fab219',
          serious: '#ec835a',
          critical: '#d03b3b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(2, 6, 23, 0.45)',
        glow: '0 0 40px rgba(52, 211, 153, 0.18)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
