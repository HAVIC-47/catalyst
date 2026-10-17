"use client";

import { Camera, Plus } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { UserMenu } from "@/components/features/user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { VaultModeToggle } from "@/components/features/vault-mode-toggle";

import { fmt } from "@/lib/utils";
import { tr } from "@/lib/i18n";
export function Topbar() {
  const { openEntry, openMemo } = useAppData();
  const today = new Date();

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-xl sm:px-6 lg:h-auto lg:py-3">
      <div className="flex items-baseline gap-2">
        <span className="label">{tr("Today")}</span>
        <span className="font-mono text-sm text-ink/70">{fmt(today, "EEE, MMM d, yyyy")}</span>
      </div>

      {/* Desktop actions. Phones and tablets have them in the bottom bar (+ scans a
          memo or notes, or a list on the boards) and the More sheet. */}
      <div className="ml-auto hidden items-center gap-3 lg:flex">
        <VaultModeToggle />
        <button
          onClick={openMemo}
          title={tr("Scan a memo, a receipt or a screenshot of your notes")}
          className="hairline inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <Camera className="h-4 w-4" aria-hidden />
          {tr("Scan memo")}
        </button>
        <button
          onClick={() => openEntry()}
          className="entry-btn inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper shadow-entry transition-transform duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
          {tr("Entry")}
        </button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
