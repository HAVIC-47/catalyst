"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, Trash2, MapPin } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { Transaction } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";

export default function TransactionsPage() {
  const { transactions, categories, removeMoney, openEntry, loading } = useAppData();
  const colorOf = useMemo(
    () => new Map(categories.map((c) => [c.name, c.color])),
    [categories],
  );

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of transactions) {
      (m.get(t.occurredOn) ?? m.set(t.occurredOn, []).get(t.occurredOn)!).push(t);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Ledger · {transactions.length} total</div>
          <h1 className="font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Trans<span className="serif-italic text-amber/90">actions.</span>
          </h1>
        </div>
        <button
          onClick={() => openEntry({ tab: "money" })}
          className="entry-btn min-h-[42px] cursor-pointer rounded-xl px-4 text-sm font-semibold text-black shadow-entry"
        >
          + Add
        </button>
      </div>

      {!loading && transactions.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-white/40">
          No transactions yet. Hit <span className="text-white/70">+ Add</span> or click a calendar day.
        </div>
      )}

      <div className="space-y-6">
        {groups.map(([date, items]) => {
          const dayNet = items.reduce((s, t) => s + (t.kind === "income" ? t.amount : -t.amount), 0);
          return (
            <div key={date} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <span className="font-mono text-xs uppercase tracking-widest text-white/45">
                  {format(parseISO(date), "EEE · MMM d, yyyy")}
                </span>
                <span className={cn("font-mono text-xs tabular", dayNet >= 0 ? "text-income" : "text-expense")}>
                  {formatCurrency(dayNet, { sign: true })}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {items.map((t) => {
                  const Icon = t.kind === "income" ? ArrowDownLeft : ArrowUpRight;
                  const color = colorOf.get(t.categoryName) ?? "#64748B";
                  return (
                    <li key={t.id} className="group flex items-center gap-3 px-5 py-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {t.categoryName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-white/85">
                          {t.note || t.categoryName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                          <span>{t.categoryName}</span>
                          {t.place && (
                            <>
                              <MapPin className="h-3 w-3" aria-hidden />
                              <span className="truncate">{t.place}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Icon
                        className={cn("h-3.5 w-3.5 shrink-0", t.kind === "income" ? "text-income" : "text-expense")}
                        aria-hidden
                      />
                      <span className={cn("font-mono text-sm tabular", t.kind === "income" ? "text-income" : "text-white/80")}>
                        {formatCurrency(t.kind === "income" ? t.amount : -t.amount, { sign: true })}
                      </span>
                      <button
                        onClick={() => removeMoney(t.id)}
                        aria-label="Delete"
                        className="cursor-pointer text-white/0 transition-colors group-hover:text-white/30 hover:!text-expense"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
