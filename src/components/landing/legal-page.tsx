// Layout for the public Privacy Policy, Terms and Delete account pages (linked
// from the landing footer, the Google sign-in consent screen, the Android app and
// the Google Play listing).
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

/** The app's name on Google Play — the Play policies want these pages to use it. */
export const PLAY_NAME = "Catalyst: Money & Mood";

/** The public support address (also on the Google Play listing). If it's ever
 *  emptied, the pages point to GitHub issues instead. */
export const SUPPORT_EMAIL: string = "catalyst.hishab@gmail.com";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen min-h-dvh px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">Catalyst</span>
        </Link>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink/40">Last updated {updated}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink/75">{children}</div>
        <footer className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-sm text-ink/50">
          <Link href="/privacy" className="transition-colors hover:text-ink">Privacy Policy</Link>
          <Link href="/terms" className="transition-colors hover:text-ink">Terms of Service</Link>
          <Link href="/delete-account" className="transition-colors hover:text-ink">Delete your account</Link>
          <Link href="/" className="transition-colors hover:text-ink">Catalyst home</Link>
        </footer>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-amber/70">{children}</ul>;
}

export const CONTACT_URL = "https://github.com/HAVIC-47/catalyst/issues";

export const linkClass = "text-amber underline underline-offset-2 hover:text-amber/80";

/** The support address as a mail link, or GitHub issues until there is one. */
export function SupportLink() {
  return SUPPORT_EMAIL ? (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <a href={CONTACT_URL} className={linkClass}>
      github.com/HAVIC-47/catalyst/issues
    </a>
  );
}

export function Contact() {
  return (
    <p>
      Questions or requests: {SUPPORT_EMAIL ? "email" : "open an issue at"} <SupportLink />.
    </p>
  );
}
