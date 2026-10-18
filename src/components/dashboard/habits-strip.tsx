"use client";

// The streak and the challenges going (a dashboard section) — opens the page.
import { useMemo } from "react";
import Link from "next/link";
import { Flame, Trophy } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { challengeProgress, challengeTitle, loggedDays, streakOf } from "@/lib/habits";
import { cn, formatCurrency, toDateKey } from "@/lib/utils";
import { tr, trn } from "@/lib/i18n";

export function HabitsStrip({ className }: { className?: string }) {
  const { transactions, moods, challenges } = useAppData();
  const today = toDateKey(new Date());
  const streak = useMemo(() => streakOf(loggedDays(transactions, moods), today), [transactions, moods, today]);
  const going = useMemo(
    () =>
      challenges
        .map((c) => ({ c, p: challengeProgress(c, transactions, moods, today) }))
        .filter(({ p }) => p.status === "active")
        .sort((a, b) => a.p.daysLeft - b.p.daysLeft),
    [challenges, transactions, moods, today],
  );
  const first = going[0];
  return (
    <Link
      href="/app/challenges"
      aria-label={tr("Streaks & challenges")}
      className={cn("card flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 transition-colors hover:border-ink/20 sm:px-5", className)}
    >
      <span className="flex items-center gap-2.5">
        <Flame className={cn("h-5 w-5", streak.current ? "text-amber" : "text-ink/30")} aria-hidden />
        <span>
          <span className="block font-mono text-base font-semibold text-ink">{trn(streak.current, "{n}-day streak", "{n}-day streak")}</span>
          <span className="block text-[11px] text-ink/45">
            {streak.todayDone || streak.current === 0 ? tr("Best: {n} days", { n: streak.best }) : tr("Log something today to keep it.")}
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <Trophy className={cn("h-5 w-5 shrink-0", first ? "text-income" : "text-ink/30")} aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-sm text-ink/80">
            {first ? challengeTitle(first.c, tr, formatCurrency) : tr("No challenge going")}
          </span>
          <span className="block text-[11px] text-ink/45">
            {first
              ? going.length > 1
                ? tr("{n} days left · {more} more going", { n: first.p.daysLeft, more: going.length - 1 })
                : first.p.daysLeft === 1
                  ? tr("Last day")
                  : tr("{n} days left", { n: first.p.daysLeft })
              : tr("Start one — a week of no-spend days?")}
          </span>
        </span>
      </span>
    </Link>
  );
}
