"use client";

// In-app reminders at the top of every page: bills due by tomorrow or overdue,
// dhar due back, and — after the evening check-in time — "how was today?" when no
// mood is logged yet. Each can be dismissed for the day. (Settings → Reminders.)
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Bell, HandCoins, Smile, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { debtIsOpen, debtRemaining, nextDue } from "@/lib/money";
import { formatCurrency, nowTime, toDateKey, fmt } from "@/lib/utils";
import { tr, trn } from "@/lib/i18n";

interface Item {
  key: string;
  icon: typeof Bell;
  text: string;
  tone: "due" | "late" | "calm";
  action?: { label: string; run?: () => void; href?: string };
}

const when = (days: number) => (days < 0 ? trn(-days, "{n} day late", "{n} days late") : days === 0 ? tr("due today") : tr("due tomorrow"));

export function RemindersBar() {
  const { bills, debts, debtPayments, moods, reminders, loading, payBill, undoBillPayment, pushToast, openEntry } = useAppData();
  const today = toDateKey(new Date());
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [clock, setClock] = useState(nowTime());
  const storeKey = `reminders-dismissed:${today}`;

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(storeKey) ?? "[]"));
    } catch {
      /* ignore */
    }
    // Re-check the time every minute, for the evening check-in.
    const t = setInterval(() => setClock(nowTime()), 60_000);
    return () => clearInterval(t);
  }, [storeKey]);

  // Tapping the evening reminder notification opens /app?log=mood.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("log") !== "mood") return;
    openEntry({ tab: "mood" });
    window.history.replaceState(null, "", window.location.pathname);
  }, [openEntry]);

  const items = useMemo<Item[]>(() => {
    if (loading) return [];
    const out: Item[] = [];
    if (reminders.bills) {
      for (const b of bills) {
        if (b.isPaid) continue;
        const days = differenceInCalendarDays(parseISO(b.dueOn), parseISO(today));
        if (days > 1) continue;
        out.push({
          key: `bill:${b.id}:${b.dueOn}`,
          icon: Bell,
          tone: days < 0 ? "late" : "due",
          text: `${b.name} · ${formatCurrency(b.amount)} — ${when(days)}`,
          action: {
            label: tr("Paid"),
            run: () => {
              payBill(b.id)
                .then((p) => {
                  const next = nextDue(b.dueOn, b.recurrence);
                  pushToast({
                    message:
                      tr("Paid {name} — added to the ledger.", { name: b.name }) +
                      (next ? ` ${tr("Next due {date}.", { date: fmt(parseISO(next), "MMM d") })}` : ""),
                    action: { label: tr("Undo"), run: () => undoBillPayment(p) },
                  });
                })
                .catch(() => pushToast({ tone: "warn", message: tr("Couldn't mark {name} paid — try again.", { name: b.name }) }));
            },
          },
        });
      }
    }
    if (reminders.dhar) {
      for (const d of debts) {
        if (!d.dueOn || !debtIsOpen(d, debtPayments)) continue;
        const days = differenceInCalendarDays(parseISO(d.dueOn), parseISO(today));
        if (days > 1) continue;
        const left = formatCurrency(debtRemaining(d, debtPayments));
        out.push({
          key: `dhar:${d.id}:${d.dueOn}`,
          icon: HandCoins,
          tone: days < 0 ? "late" : "due",
          text: d.direction === "lent" ? `${d.person} owes you ${left} — ${when(days)}` : `You owe ${d.person} ${left} — ${when(days)}`,
          action: { label: tr("Open"), href: "/app/dhar" },
        });
      }
    }
    if (reminders.checkin && clock >= reminders.checkinTime && !moods.some((m) => m.loggedOn === today)) {
      out.push({
        key: "checkin",
        icon: Smile,
        tone: "calm",
        text: tr("How was today? You haven't logged a mood yet."),
        action: { label: tr("Log mood"), run: () => openEntry({ tab: "mood" }) },
      });
    }
    return out;
  }, [loading, reminders, bills, debts, debtPayments, moods, today, clock, payBill, undoBillPayment, pushToast, openEntry]);

  const visible = items.filter((i) => !dismissed.includes(i.key));
  if (!visible.length) return null;

  const dismiss = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-2 px-4 pt-3 sm:px-6 lg:px-8" role="region" aria-label={tr("Reminders")}>
      {visible.slice(0, 3).map((i) => (
        <div
          key={i.key}
          className={
            "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm " +
            (i.tone === "late" ? "border-expense/35 bg-expense/[0.06]" : i.tone === "due" ? "border-amber/35 bg-amber/[0.06]" : "border-line bg-ink/[0.02]")
          }
        >
          <i.icon className={i.tone === "late" ? "h-4 w-4 shrink-0 text-expense" : "h-4 w-4 shrink-0 text-amber"} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-ink/80">{i.text}</span>
          {i.action?.href ? (
            <Link
              href={i.action.href}
              className="shrink-0 rounded-lg px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-amber transition-colors hover:bg-amber/10"
            >
              {i.action.label}
            </Link>
          ) : i.action?.run ? (
            <button
              type="button"
              onClick={() => {
                i.action!.run!();
                dismiss(i.key);
              }}
              className="shrink-0 cursor-pointer rounded-lg px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-amber transition-colors hover:bg-amber/10"
            >
              {i.action.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => dismiss(i.key)}
            aria-label={tr("Dismiss for today")}
            className="shrink-0 cursor-pointer rounded-lg p-1 text-ink/35 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
      {visible.length > 3 && <p className="px-1 font-mono text-[11px] text-ink/40">{tr("+{x} more reminders", { x: visible.length - 3 })}</p>}
    </div>
  );
}
