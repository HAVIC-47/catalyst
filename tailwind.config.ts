import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08080A", // app background
        panel: "#0E0E11", // sidebar / raised
        card: "#121215", // cards
        line: "rgba(255,255,255,0.07)", // hairline borders
        amber: { DEFAULT: "#F5B544", soft: "#FBBF24" },
        income: "#34D399",
        expense: "#F43F5E",
        neon: { cyan: "#22D3EE", purple: "#A855F7", rose: "#F43F5E" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -16px rgba(0,0,0,0.7)",
        entry: "0 8px 30px -8px rgba(245,181,68,0.45)",
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
