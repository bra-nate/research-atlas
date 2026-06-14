import type { Config } from "tailwindcss";

/**
 * Self-contained Partner Dashboard palette for the SPA (light mode). Mirrors the
 * design tokens from the legacy app's /design system: royal-blue primary, coral
 * accent, near-white canvas, hairline borders.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          fg: "#FFFFFF",
          subtle: "#EFF4FF",
        },
        accent: {
          DEFAULT: "#F97316",
          hover: "#EA580C",
          fg: "#FFFFFF",
          subtle: "#FFF3EA",
        },
        canvas: "#FCFCFC",
        surface: "#FFFFFF",
        hairline: "#EDEDED",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { xl: "12px" },
    },
  },
  plugins: [],
};

export default config;
