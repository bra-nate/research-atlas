import type { Config } from "tailwindcss";

/**
 * Research Atlas palette (see CLAUDE.md → Design Context). A deep-green
 * institutional brand with a violet accent — editorial and credible, inspired
 * by foundation sites (Wellcome) rather than the generic blue-on-white we
 * started from. Neutrals are warmed toward the green hue for subconscious
 * cohesion. Legacy aliases (canvas/surface/hairline) are kept so older
 * components keep compiling.
 */
const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep-green brand — links, primary buttons, active states.
        brand: {
          DEFAULT: "#0F5C4D",
          hover: "#0B463B",
          deep: "#0A2E29", // hero / nav / footer bands
          deeper: "#072019", // deepest band edge for gradients
          fg: "#FFFFFF",
          subtle: "#E6F2EE",
        },
        // Brighter green for data highlights / positive accents — used sparingly.
        emerald: {
          DEFAULT: "#15A06B",
          soft: "#D6F2E5",
        },
        // Violet accent — CTAs and the hero-feature surfaces only.
        accent: {
          DEFAULT: "#6D28D9",
          hover: "#5B21B6",
          fg: "#FFFFFF",
          subtle: "#F2ECFB",
        },
        // Warm-tinted neutrals (toward the green hue).
        ink: {
          DEFAULT: "#16201D",
          secondary: "#5C6B66",
        },
        border: "#E2E8E4",
        "surface-alt": "#F4F6F5",
        tag: {
          bg: "#EEF2F0",
          ink: "#33433D",
        },
        positive: "#15A06B",
        // Legacy aliases (kept so pre-redesign components compile).
        canvas: "#FFFFFF",
        surface: "#FFFFFF",
        hairline: "#E2E8E4",
      },
      fontFamily: {
        // Distinctive editorial display (headings) + warm humanist body.
        display: ['"Space Mono"', "ui-monospace", "monospace"],
        sans: [
          '"Plus Jakarta Sans"',
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ['"Space Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { xl: "12px", "2xl": "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(10,46,41,.04), 0 1px 4px rgba(10,46,41,.06)",
        lift: "0 8px 24px -8px rgba(10,46,41,.18)",
      },
      maxWidth: { shell: "1200px" },
    },
  },
  plugins: [],
};

export default config;
