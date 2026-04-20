/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow':     'spin 2s linear infinite',
        'bounce-subtle': 'bounce 1.5s ease-in-out infinite',
        'fade-in':       'fadeIn 0.4s ease-out',
        'slide-up':      'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 },              to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: 0 },
                   to:   { transform: 'translateY(0)',    opacity: 1 } },
      },
      backgroundImage: {
        'grid-dark': 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
    },
  },
  plugins: [],
};
