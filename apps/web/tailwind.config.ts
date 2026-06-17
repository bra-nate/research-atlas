import type { Config } from "tailwindcss";

/**
 * Crunchbase-style palette for the Directory SPA (see DESIGN.md): white surfaces,
 * a single vivid blue for links/actions, cool greys, near-black ink. Legacy
 * aliases (canvas/surface/hairline) are kept so older components keep compiling.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0A66FF",
          hover: "#0A4FCC",
          fg: "#FFFFFF",
          subtle: "#EAF1FF",
        },
        ink: {
          DEFAULT: "#16181D",
          secondary: "#667085",
        },
        border: "#E4E7EC",
        "surface-alt": "#F5F7FA",
        tag: {
          bg: "#EFF1F4",
          ink: "#344054",
        },
        positive: "#067647",
        accent: {
          DEFAULT: "#F97316",
          hover: "#EA580C",
          fg: "#FFFFFF",
          subtle: "#FFF3EA",
        },
        canvas: "#FFFFFF",
        surface: "#FFFFFF",
        hairline: "#E4E7EC",
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
