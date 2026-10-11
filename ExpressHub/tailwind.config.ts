import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        secondary: "#006a61",
        "secondary-container": "#86f2e4",
        background: "#f8f9ff",
        surface: "#f8f9ff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#45464d",
        "on-secondary-container": "#006f66",
        "outline-variant": "#c6c6cd",
        error: "#ba1a1a",
        "error-container": "#ffdad6"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      fontFamily: {
        inter: ["var(--font-inter)"],
        jakarta: ["var(--font-plus-jakarta)"]
      }
    }
  },
  plugins: []
};

export default config;
