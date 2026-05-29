import type { Config } from "tailwindcss";

// Editorial Almanac palette — warm bone paper, ink-black type, oxblood accent.
// Token names kept stable (amber/income/expense/neon) so existing classes remap
// automatically; values are the only thing that changed.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surface + text tokens flip between light/dark via CSS vars (see globals.css).
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        line: "var(--c-line)",
        // `amber` token == primary accent everywhere → oxblood (lifts in dark mode)
        amber: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          soft: "rgb(var(--c-accent) / <alpha-value>)",
        },
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        // Data tones stay fixed — readable on both bone and pure black.
        income: "#2E8159", // ledger green (credit)
        expense: "#CB453B", // ledger red (debit)
        saving: "#3D80BC", // ink blue
        neon: { cyan: "#3D80BC", purple: "#9268A0", rose: "#CB453B" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Flat editorial — barely-there paper lift, no glow.
        card: "0 1px 2px rgba(26,23,20,0.04), 0 1px 0 rgba(255,255,255,0.6) inset",
        entry: "0 2px 0 rgba(26,23,20,0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
