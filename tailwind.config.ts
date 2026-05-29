import type { Config } from "tailwindcss";

// Editorial Almanac palette — warm bone paper, ink-black type, oxblood accent.
// Token names kept stable (amber/income/expense/neon) so existing classes remap
// automatically; values are the only thing that changed.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F0E8", // page background (bone)
        panel: "#ECE4D2", // sidebar / raised surface
        card: "#FBF7EE", // card surface
        ink: "#1A1714", // primary text (near-black, warm)
        line: "rgba(26,23,20,0.14)", // hairline borders
        // `amber` token == primary accent everywhere → oxblood
        amber: { DEFAULT: "#9B3A2D", soft: "#B5503F" },
        accent: "#9B3A2D",
        income: "#2F6B4E", // ledger green (credit)
        expense: "#B23A2C", // ledger red (debit)
        saving: "#34618A", // ink blue
        neon: { cyan: "#34618A", purple: "#7A4E86", rose: "#B23A2C" },
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
