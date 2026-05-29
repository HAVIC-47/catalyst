"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial state.
      gsap.set(
        [
          ".hero-kicker",
          ".hero-line",
          ".hero-sub",
          ".hero-ctas",
          ".hero-stats",
          ".hero-card",
        ],
        { opacity: 0, y: 24 },
      );

      // Orchestrated reveal.
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.to(".hero-kicker", { opacity: 1, y: 0, duration: 0.6 })
        .to(".hero-line", { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, "-=0.25")
        .to(".hero-sub", { opacity: 1, y: 0, duration: 0.7 }, "-=0.45")
        .to(".hero-ctas", { opacity: 1, y: 0, duration: 0.6 }, "-=0.35")
        .to(".hero-stats", { opacity: 1, y: 0, duration: 0.6 }, "-=0.4")
        .to(".hero-card", { opacity: 1, y: 0, duration: 0.8, stagger: 0.12 }, "-=0.6");

      // Continuous floating orbs.
      gsap.to(".orb-a", {
        x: 40,
        y: -25,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".orb-b", {
        x: -50,
        y: 30,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".orb-c", {
        x: 25,
        y: 20,
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // Subtle parallax on the preview card.
      gsap.to(".hero-card", {
        y: -12,
        duration: 4.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative isolate overflow-hidden pb-16 pt-28 sm:pt-36 md:pt-40 lg:pb-24 lg:pt-44"
    >
      {/* Soft paper washes — warm, low-contrast, no neon. */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="orb-a absolute -left-32 top-10 h-72 w-72 rounded-full bg-[#9B3A2D]/[0.10] blur-[130px] sm:h-96 sm:w-96" />
        <div className="orb-b absolute right-[-10%] top-32 h-80 w-80 rounded-full bg-[#B59A3C]/[0.14] blur-[150px] sm:h-[28rem] sm:w-[28rem]" />
        <div className="orb-c absolute bottom-[-10%] left-1/3 h-72 w-72 rounded-full bg-[#2E8159]/[0.08] blur-[130px]" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-8">
        <div>
          <div className="hero-kicker mb-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-ink/[0.03] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.25em] text-amber backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Mood × Money
          </div>

          <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl md:text-7xl">
            <span className="hero-line block">Money meets</span>
            <span className="hero-line block">
              <span className="serif-italic text-amber/95">mood.</span>
            </span>
          </h1>

          <p className="hero-sub mt-6 max-w-xl text-base leading-relaxed text-ink/55 sm:text-lg">
            Catalyst maps every taka against how you actually felt that day. Spot the days they
            collide — and stop letting low moods drain your wallet.
          </p>

          <div className="hero-ctas mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup?from=landing"
              className="entry-btn group inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl px-6 text-sm font-semibold text-paper shadow-entry transition-transform duration-200 hover:brightness-110 active:scale-[0.99]"
            >
              Start tracking free
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/login?from=landing"
              className="inline-flex min-h-[48px] cursor-pointer items-center rounded-xl border border-ink/10 px-6 text-sm font-medium text-ink/80 transition-colors hover:bg-ink/[0.04]"
            >
              I have an account
            </Link>
          </div>

          <dl className="hero-stats mt-10 grid max-w-md grid-cols-3 gap-6">
            {[
              { v: "৳", l: "Built for BDT" },
              { v: "5", l: "Mood levels" },
              { v: "RLS", l: "Private by default" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl font-semibold text-ink">{s.v}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink/40">
                  {s.l}
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Right side: mocked preview card */}
        <div className="relative">
          <div className="hero-card relative mx-auto w-full max-w-md rounded-3xl border border-ink/10 bg-card/80 p-6 shadow-card backdrop-blur-xl">
            <div className="label mb-2">Dashboard · this month</div>
            <h3 className="font-display text-3xl font-semibold text-ink">
              The month <span className="serif-italic text-amber/90">so far.</span>
            </h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-ink/[0.02] p-3">
                <div className="label">Spent</div>
                <div className="mt-1 font-mono text-xl text-ink">৳1,000</div>
              </div>
              <div className="rounded-xl border border-line bg-ink/[0.02] p-3">
                <div className="label">Earned</div>
                <div className="mt-1 font-mono text-xl text-income">৳5,500</div>
              </div>
            </div>
            <div className="mt-4 flex items-end gap-1.5">
              {[10, 30, 18, 44, 24, 60, 42].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h * 1.6}px`,
                    background: i % 2 ? "#2E8159" : "#CB453B",
                    opacity: 0.9,
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-xs text-ink/45">
              <span>Mood ×</span>
              <span>r = −0.74</span>
            </div>
          </div>
          {/* Decorative card behind */}
          <div className="hero-card pointer-events-none absolute -right-6 top-12 -z-10 h-40 w-40 rotate-6 rounded-3xl border border-ink/5 bg-gradient-to-br from-[#9B3A2D]/20 to-[#B59A3C]/20 blur-2xl" />
        </div>
      </div>
    </section>
  );
}
