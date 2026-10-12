import type { Config } from "tailwindcss";

// Editorial Almanac palette — warm-white paper (light) / true black (dark), ink
// type, terracotta-clay accent. Token names kept stable (amber/income/expense/neon)
// so existing classes remap automatically; values live in CSS vars (globals.css).
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
        // Data tones: same hues in both themes, a shade deeper on white for contrast.
        income: "rgb(var(--c-income) / <alpha-value>)", // ledger green (credit)
        expense: "rgb(var(--c-expense) / <alpha-value>)", // ledger red (debit)
        saving: "rgb(var(--c-saving) / <alpha-value>)", // ink blue
        neon: {
          cyan: "rgb(var(--c-saving) / <alpha-value>)",
          purple: "#9268A0",
          rose: "rgb(var(--c-expense) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Light: white cards lifted off the paper by a hairline + soft layered shadow.
        // (Dark mode overrides both in globals.css.)
        card: "0 1px 2px rgb(24 21 18 / 0.05), 0 8px 24px -14px rgb(24 21 18 / 0.16)",
        entry: "inset 0 1px 0 rgb(255 255 255 / 0.18), 0 6px 16px -8px rgb(var(--c-accent) / 0.6)",
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
