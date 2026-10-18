"use client";

// The frame of each Settings page (a way back, its title) and the rows of the
// Settings list that lead to them.
import Link from "next/link";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export function SettingsPage({
  title,
  wide = false,
  back = "/app/settings",
  backLabel,
  children,
}: {
  title: string;
  wide?: boolean;
  back?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className={cn("mx-auto", wide ? "max-w-5xl" : "max-w-3xl")}>
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={back}
            aria-label={backLabel ?? tr("Back to Settings")}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line text-ink/60 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <div className="label">{tr("Settings")}</div>
            <h1 className="truncate font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A card of Settings rows, with hairlines between them. */
export function SettingsCard({ children }: { children: React.ReactNode }) {
  return <div className="card divide-y divide-line overflow-hidden p-0">{children}</div>;
}

/** One row of Settings: what it is, how it's set now, and the way in. */
export function SettingsRow({ href, icon: Icon, title, hint, accentHint = false }: { href: string; icon: LucideIcon; title: string; hint: string; accentHint?: boolean }) {
  return (
    <Link href={href} className="group flex cursor-pointer items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-ink/[0.03] sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-amber">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className={cn("mt-0.5 block truncate text-[13px]", accentHint ? "text-amber" : "text-ink/50")}>{hint}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink/30 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
