/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'heading': ['Nunito', 'sans-serif'],
        'body': ['Inter', 'Roboto', 'Open Sans', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'gradient': 'gradient 8s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'gradient-text': 'linear-gradient(to right, var(--tw-gradient-stops))',
      },
      colors: {
        // Soft Neo-Brutalism / Playful Education palette
        'neo-cream': '#FFFBF6',
        'neo-blue': '#BBE6F0',
        'neo-charcoal': '#1F2937',
        'neo-gray': '#4B5563',
        'neo-green': '#22C55E',
        'neo-accent-blue': '#A5D6E8',
        'neo-pink': '#FF9F9F',
        'neo-yellow': '#FCD34D',
        'neo-border': '#111827',
        // Keep old colors for backward compatibility
        'warm-cream': '#FFFBF6',
        'warm-brown': '#1F2937',
        'warm-orange': '#22C55E',
        'warm-olive': '#A5D6E8',
        'warm-gray': '#E5E7EB',
      },
      boxShadow: {
        'neo': '3px 3px 0px 0px #111827',
        'neo-hover': '5px 5px 0px 0px #111827',
        'neo-active': '1px 1px 0px 0px #111827',
        'neo-lg': '6px 6px 0px 0px #111827',
      },
      borderRadius: {
        'neo-sm': '8px',
        'neo-md': '12px',
        'neo-lg': '16px',
        'neo-xl': '24px',
      },
    },
  },
  plugins: [],
};
