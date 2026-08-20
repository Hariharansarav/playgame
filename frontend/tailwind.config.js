/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        poker: {
          felt: "#14532d",       // Deep felt green
          feltDark: "#0f3e21",   // Very dark felt
          gold: "#eab308",       // Classic casino gold
          goldDark: "#ca8a04",   // Dark gold accents
          wood: "#78350f",       // Rich mahogany
          woodLight: "#92400e",  // Medium brown
        }
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "sans-serif"],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'felt-inner': 'inset 0 0 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'deal-card': 'deal 0.5s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s infinite alternate',
      },
      keyframes: {
        deal: {
          '0%': { transform: 'translateY(-100px) rotate(15deg) scale(0.8)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: '1' }
        },
        'pulse-glow': {
          '0%': { boxShadow: '0 0 4px rgba(234, 179, 8, 0.4)' },
          '100%': { boxShadow: '0 0 16px rgba(234, 179, 8, 0.8)' }
        }
      }
    },
  },
  plugins: [],
}
