import type { Metadata } from "next";
import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// High-contrast characterful serif for big display headings ("May 2026").
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const body = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Catalyst — Mood & Money",
  description:
    "Correlate daily cash flow with daily mood. Predictive personal analytics with a Main Character aesthetic.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050506",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
