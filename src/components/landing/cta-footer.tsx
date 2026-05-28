import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaFooter() {
  return (
    <section className="relative px-4 pb-20 pt-8 sm:px-6 sm:pb-28">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-card p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />

          <h2 className="relative font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Start the <span className="serif-italic text-amber/90">honest</span> ledger.
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/55 sm:text-base">
            Free. Private. ৳ from day one. Sign up in under thirty seconds.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="entry-btn group inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl px-6 text-sm font-semibold text-black shadow-entry"
            >
              Create account
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[48px] cursor-pointer items-center rounded-xl border border-white/10 px-6 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.04]"
            >
              Log in
            </Link>
          </div>
        </div>

        <footer className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.05] pt-6 sm:flex-row">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-white">Catalyst</span>
            <span className="label text-amber/70">৳ BD</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/35">
            Mood × money · v0.3
          </div>
        </footer>
      </div>
    </section>
  );
}
