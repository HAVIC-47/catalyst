import Link from "next/link";

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.04] bg-ink/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-white">Catalyst</span>
          <span className="label text-amber/70">৳ BD</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden min-h-[40px] cursor-pointer items-center rounded-xl px-4 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="entry-btn inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-black shadow-entry"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
