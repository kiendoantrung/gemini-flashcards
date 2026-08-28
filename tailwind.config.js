/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'heading': ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'body': ['Nunito', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'feather': ['Nunito', 'ui-sans-serif', 'sans-serif'],
        'duo-sans': ['Nunito', 'Inter', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'gradient': 'gradient 8s linear infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.25s ease-out forwards',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-4deg)' },
          '75%': { transform: 'rotate(4deg)' },
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
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      colors: {
        // Official Duolingo Design Tokens
        'duo-green': '#58cc02',
        'duo-green-dark': '#58a700',
        'duo-green-subtle': '#d7ffb8',
        'duo-blue': '#1cb0f6',
        'duo-blue-dark': '#1899d6',
        'duo-blue-subtle': '#ddf4ff',
        'duo-fresh': '#a5ed6e',
        'duo-night': '#000437',
        'duo-paper': '#ffffff',
        'duo-charcoal': '#4b4b4b',
        'duo-pencil': '#777777',
        'duo-gray': '#afafaf',
        'duo-border': '#e5e5e5',
        'duo-border-dark': '#cecece',
        'duo-gold': '#ffc800',
        'duo-gold-dark': '#e5a500',
        'duo-gold-subtle': '#fff7cc',
        'duo-red': '#ff4b4b',
        'duo-red-dark': '#ea2b2b',
        'duo-red-subtle': '#ffdfe0',
        'duo-purple': '#ce82ff',
        'duo-orange': '#ff9600',

        // Token aliases matching Style Reference
        'color-eager-green': '#58cc02',
        'color-storybook-green': '#d7ffb8',
        'color-spark-blue': '#1cb0f6',
        'color-fresh-leaf': '#a5ed6e',
        'color-night-ink': '#000437',
        'color-paper-white': '#ffffff',
        'color-charcoal': '#4b4b4b',
        'color-pencil-gray': '#777777',
        'color-faded-gray': '#afafaf',

        // Legacy compatibility aliases mapped to Duolingo palette
        'neo-cream': '#ffffff',
        'neo-blue': '#ddf4ff',
        'neo-charcoal': '#4b4b4b',
        'neo-gray': '#777777',
        'neo-green': '#58cc02',
        'neo-accent-blue': '#1cb0f6',
        'neo-pink': '#ffdfe0',
        'neo-yellow': '#ffc800',
        'neo-border': '#e5e5e5',
        'dark': '#4b4b4b',
        'primary-green': '#58cc02',
        'accent-yellow': '#ffc800',
        'accent-pink': '#ffdfe0',
      },
      boxShadow: {
        'duo-green': '0 4px 0 #58a700',
        'duo-green-active': '0 0 0 #58a700',
        'duo-blue': '0 4px 0 #1899d6',
        'duo-blue-active': '0 0 0 #1899d6',
        'duo-white': '0 4px 0 #e5e5e5',
        'duo-white-active': '0 0 0 #e5e5e5',
        'duo-red': '0 4px 0 #ea2b2b',
        'duo-gold': '0 4px 0 #e5a500',
        'duo-card': '0 4px 0 #e5e5e5',
        'duo-card-hover': '0 6px 0 #cecece',
        'duo-card-lift': '0 8px 0 #e5e5e5',
        'duo-modal': '0 12px 0 rgba(0, 0, 0, 0.08), 0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        // Legacy shadows
        'neo': '0 3px 0 0 #e5e5e5',
        'neo-hover': '0 5px 0 0 #cecece',
        'neo-active': '0 1px 0 0 #e5e5e5',
        'neo-lg': '0 6px 0 0 #e5e5e5',
      },
      borderRadius: {
        'duo-sm': '10px',
        'duo-md': '14px',
        'duo-lg': '16px',
        'duo-xl': '20px',
        'duo-2xl': '24px',
        'duo-pill': '9999px',
        'neo-sm': '10px',
        'neo-md': '14px',
        'neo-lg': '16px',
        'neo-xl': '20px',
      },
    },
  },
  plugins: [],
};
