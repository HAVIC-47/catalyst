"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  CalendarDays,
  LayoutGrid,
  Wallet,
  PiggyBank,
  Target,
  Bell,
  NotebookPen,
  Sparkles,
  Tag,
  Activity,
  Smile,
  Lock,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Calendar entry",
    body: "Tap any date to log money or mood. Each day glows by your spend and feeling.",
    accent: "#F5B544",
  },
  {
    icon: Wallet,
    title: "Money × Mood, one widget",
    body: "Two tabs, three taps. Log a taka and a feeling in seconds — at any time of day.",
    accent: "#2E8159",
  },
  {
    icon: LayoutGrid,
    title: "Trend that overlaps",
    body: "Net cash flow against mood index, dual axis, with Day / Week / Month / Year navigation.",
    accent: "#3D80BC",
  },
  {
    icon: Tag,
    title: "Categories your way",
    body: "Pick presets or invent your own. Color, rename, delete — every category bends to you.",
    accent: "#7A4E86",
  },
  {
    icon: Smile,
    title: "5 moods, context tags",
    body: "Tag what the day was about — Family time, Travel, Work — and watch patterns emerge.",
    accent: "#A6694A",
  },
  {
    icon: PiggyBank,
    title: "Budgets that breathe",
    body: "Set monthly limits per category. Watch each one fill — go red when you overshoot.",
    accent: "#B59A3C",
  },
  {
    icon: Target,
    title: "Goals with momentum",
    body: "Track savings targets, log additions, see progress bars climb toward the finish.",
    accent: "#3D80BC",
  },
  {
    icon: Bell,
    title: "Bills, never forgotten",
    body: "Due-date countdowns, recurrence, one-tap paid. Outstanding tally up top.",
    accent: "#8E5B6E",
  },
  {
    icon: NotebookPen,
    title: "Journal + activities",
    body: "Write the day's story. Track custom habits — Workout, Sleep, Read — your own list.",
    accent: "#7A4E86",
  },
  {
    icon: Activity,
    title: "Hourly intraday view",
    body: "Day mode breaks transactions and moods into hours. See when the spending happens.",
    accent: "#2F6F6B",
  },
  {
    icon: Lock,
    title: "Yours alone",
    body: "Email signup, Postgres with row-level security. Your data, your eyes only.",
    accent: "#94A3B8",
  },
  {
    icon: Sparkles,
    title: "Built for taka",
    body: "৳ native, en-IN grouping, dark moody aesthetic. Made for how you actually live.",
    accent: "#F5B544",
  },
];

export function Features() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      // gsap.from with immediateRender:false — cards stay visible by default and
      // only animate in when the user actually scrolls (no permanent hidden state
      // if ScrollTrigger never fires, e.g. in headless screenshot capture).
      gsap.utils.toArray<HTMLElement>(".feature-card").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
        });
      });

      gsap.from(".features-heading", {
        opacity: 0,
        y: 24,
        duration: 0.8,
        ease: "power4.out",
        immediateRender: false,
        scrollTrigger: { trigger: ".features-heading", start: "top 85%" },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="features-heading mb-12 max-w-2xl">
          <div className="label mb-3">Features</div>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Built to make money <span className="serif-italic text-amber/90">feel honest.</span>
          </h2>
          <p className="mt-4 text-base text-ink/55">
            Everything you need to track spending, mood, budgets, goals, bills, and the daily
            story underneath them — in one place.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="feature-card group relative overflow-hidden rounded-2xl border border-line bg-card p-6 transition-colors duration-300 hover:border-ink/15"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${f.accent}1f`, color: f.accent }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/55">{f.body}</p>
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
                  style={{ backgroundColor: f.accent }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
