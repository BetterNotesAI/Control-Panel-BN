import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0B1020",
        surface: "#121A2C",
        surfaceMuted: "#1A2440",
        border: "#2A3658",
        foreground: "#E7EEFF",
        muted: "#98A7CC",
        success: "#4CD7A7",
        warning: "#F5B85A",
        danger: "#F77979",
        info: "#5AB4F5",
      },
      boxShadow: {
        soft: "0 12px 30px rgba(3, 7, 18, 0.35)",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Avenir Next", "Segoe UI", "sans-serif"],
      },
      backgroundImage: {
        "panel-grid":
          "radial-gradient(circle at 1px 1px, rgba(151,167,207,0.14) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};

export default config;
