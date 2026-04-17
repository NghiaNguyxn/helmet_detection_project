/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b1326",
        "surface-low": "#131b2e",
        surface: "#171f33",
        "surface-highest": "#2d3449",
        primary: {
          DEFAULT: "#aac7ff",
          container: "#3e90ff",
        },
        secondary: {
          DEFAULT: "#4edea3",
          container: "#00a572",
        },
        error: {
          DEFAULT: "#ffb2b7",
          container: "#ff516a",
        },
        "on-surface": "#dae2fd",
        "on-surface-variant": "#c0c6d6",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'md': '0.75rem',
        'sm': '0.25rem',
      }
    },
  },
  plugins: [],
}
