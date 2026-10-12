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
  themeColor: "#000000",
};

// Dark ships by default in the server-rendered HTML (class="dark"); this runs
// before paint and only removes it when the user explicitly chose light. It also
// points the browser-chrome color (theme-color meta) at the active theme; the
// colors match THEME_COLOR in theme-toggle.tsx.
const themeInit = `(function(){try{var light=localStorage.getItem('theme')==='light';if(light){document.documentElement.classList.remove('dark')}var set=function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',light?'#F6F5F1':'#000000')};set();document.addEventListener('DOMContentLoaded',set)}catch(e){}})();`;

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
