"use client";

// The calendar day window's Transactions tab: that day's entries and dhar, with the day's totals.
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { cn, formatCurrency } from "@/lib/utils";
import { defaultWallet, dharMoves } from "@/lib/money";
import { CategoryIcon } from "@/components/ui/category-icon";
import { DharLine } from "@/components/dhar/dhar-line";
import { tr } from "@/lib/i18n";

export function DayList({ dateKey }: { dateKey: string }) {
  const { transactions, categories, debts, debtPayments, wallets, setEntryTab } = useAppData();
  const items = transactions.filter((t) => t.occurredOn === dateKey).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const moves = useMemo(() => dharMoves(debts, debtPayments).filter((m) => m.date === dateKey), [debts, debtPayments, dateKey]);
  const walletName = (id: string | null) => tr((wallets.find((w) => w.id === id) ?? defaultWallet(wallets))?.name ?? "");
  const showWallets = wallets.filter((w) => !w.archived).length > 1;
  const income = items.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expense = items.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);

  if (items.length === 0 && moves.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-ink/45">
        {tr("Nothing on this day yet.")}{" "}
        <button onClick={() => setEntryTab("money")} className="cursor-pointer text-amber hover:underline">
          {tr("Add an entry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 font-mono text-xs tabular">
        <span className="text-income">{tr("In {amount}", { amount: formatCurrency(income) })}</span>
        <span className="text-expense">{tr("Out {amount}", { amount: formatCurrency(expense) })}</span>
        <span className={cn(income - expense >= 0 ? "text-income" : "text-expense")}>
          {tr("Net {amount}", { amount: formatCurrency(income - expense, { sign: true }) })}
        </span>
      </div>
      <ul className="-mx-6 divide-y divide-line border-y border-line">
        {items.map((t) => {
          const cat = categories.find((c) => c.name === t.categoryName);
          const Icon = t.kind === "income" ? ArrowDownLeft : ArrowUpRight;
          return (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <CategoryIcon name={t.categoryName} icon={cat?.icon ?? null} color={cat?.color ?? "#7A746A"} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink/85">{t.note || tr(t.categoryName)}</div>
                <div className="truncate text-[11px] text-ink/40">
                  {tr(t.categoryName)}
                  {showWallets && t.kind !== "saving" && ` · ${walletName(t.walletId)}`}
                  {t.place && ` · ${t.place}`}
                </div>
              </div>
              <Icon className={cn("h-3.5 w-3.5 shrink-0", t.kind === "income" ? "text-income" : "text-expense")} aria-hidden />
              <span className={cn("font-mono text-sm tabular", t.kind === "income" ? "text-income" : "text-ink/80")}>
                {formatCurrency(t.kind === "income" ? t.amount : -t.amount, { sign: true })}
              </span>
            </li>
          );
        })}
        {moves.map((m) => (
          <DharLine key={m.id} move={m} wallet={showWallets ? walletName(m.walletId) : undefined} />
        ))}
      </ul>
      {moves.length > 0 && <p className="text-[11px] text-ink/40">{tr("Dhar moves money in and out of a wallet; it isn't income or spending.")}</p>}
    </div>
  );
}
