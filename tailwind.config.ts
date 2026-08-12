import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Navy — primary brand color (maps to brand-* for UI component compat)
        brand: {
          50: "#f0f5f9",
          100: "#d9e7f0",
          200: "#b5cde0",
          300: "#82aac6",
          400: "#4d87ad",
          500: "#2b6492",
          600: "#1F3A54",
          700: "#142838",
          800: "#0e1e2a",
          900: "#0a141c",
          950: "#060d12",
        },
        // Amber — CTA / accent color (maps to accent-* for UI component compat)
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#F2A93C",
          700: "#D98F1F",
          800: "#b55a0a",
          900: "#8d3c06",
          950: "#521d02",
        },
        // Semantic design tokens
        cream: {
          DEFAULT: "#FAF7F1",
          panel: "#F1ECE2",
        },
        coral: "#FF7A59",
        ink: {
          DEFAULT: "#23262B",
          soft: "#5C6470",
        },
        navy: {
          DEFAULT: "#1F3A54",
          dark: "#142838",
        },
        amber: {
          DEFAULT: "#F2A93C",
          dark: "#D98F1F",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [forms, typography],
};

export default config;
