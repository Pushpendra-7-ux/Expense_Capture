/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0B0F',
          800: '#17171D',
          700: '#26262E',
          500: '#4B4B56',
          400: '#6D6D78',
        },
        paper: '#F5F2EB',
        cream: '#FBF9F4',
        line: {
          DEFAULT: '#E5DFD3',
          soft: '#EFEBE2',
          strong: '#D6CEBE',
        },
        amber: {
          50: '#FBF4E4',
          100: '#F6E8C9',
          200: '#EED6A3',
          300: '#E2BC72',
          400: '#D4A24A',
          500: '#C58A2A',
          600: '#A76F1D',
        },
        success: {
          50: '#EAF4EE',
          100: '#D5E9DD',
          500: '#2F7D54',
          600: '#246343',
        },
        danger: {
          50: '#FAECEC',
          100: '#F4DADA',
          500: '#B4453F',
          600: '#943630',
        },
        info: {
          50: '#EEF2F7',
          500: '#4B657F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 11, 15, 0.04), 0 8px 24px rgba(11, 11, 15, 0.04)',
        lift: '0 12px 32px rgba(11, 11, 15, 0.10)',
        dock: '0 8px 30px rgba(11, 11, 15, 0.12)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 220ms ease-out',
        'slide-in': 'slide-in 220ms ease-out',
        'slide-in-left': 'slide-in-left 220ms ease-out',
      },
    },
  },
  plugins: [],
};
