import type { Metadata } from "next";
import { Newsreader, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Heartbeat } from "@/components/system/heartbeat";
import "./globals.css";

// Editorial newspaper serif for display headings + its expressive italic.
const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
// Humanist grotesque for body copy — clean, characterful, not Inter.
const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});
// Typewriter-leaning mono for ledger numbers.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Catalyst — Mood & Money",
  description:
    "An honest ledger that maps every taka against how the day actually felt.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4F0E8",
};

// Dark ships by default in the server-rendered HTML (class="dark"); this runs
// before paint and only removes it when the user explicitly chose light.
const themeInit = `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.remove('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans antialiased">
        <Heartbeat />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
