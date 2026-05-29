import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">Catalyst</span>
          <span className="label text-amber/70">৳ BD</span>
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login?from=landing"
            className="hidden min-h-[40px] cursor-pointer items-center rounded-xl px-4 text-sm font-medium text-ink/70 transition-colors hover:text-ink sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup?from=landing"
            className="entry-btn inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-paper shadow-entry"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
