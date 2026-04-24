/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#0a0e14",
          panel: "#121820",
          border: "#1e2a3a",
          accent: "#00d4aa",
          muted: "#6b7c93",
          danger: "#ff5c5c",
          warn: "#ffb020",
        },
      },
      fontFamily: {
        sans: ["JetBrains Mono", "ui-monospace", "monospace"],
        display: ["Orbitron", "sans-serif"],
      },
    },
  },
  plugins: [],
};
