"use client";

import { useMemo, useState } from "react";
import { isSameMonth } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { currencySymbol, cn, formatCurrency, vivid } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { tr } from "@/lib/i18n";

export default function BudgetsPage() {
  const { budgets, transactions, categories, createBudget, editBudget, removeBudget, loading } =
    useAppData();
  const now = new Date();

  const spentByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.kind !== "expense" || !isSameMonth(new Date(t.occurredOn), now)) continue;
      m.set(t.categoryName, (m.get(t.categoryName) ?? 0) + t.amount);
    }
    return m;
  }, [transactions]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const usedCatIds = new Set(budgets.map((b) => b.categoryId));
  const available = expenseCats.filter((c) => !usedCatIds.has(c.id));

  const [newCatId, setNewCatId] = useState("");
  const [newAmt, setNewAmt] = useState("");

  const add = async () => {
    const cat = expenseCats.find((c) => c.id === newCatId) ?? available[0];
    const amt = parseFloat(newAmt);
    if (!cat || !(amt > 0)) return;
    await createBudget({ categoryId: cat.id, categoryName: cat.name, amount: amt, period: "monthly" });
    setNewAmt("");
    setNewCatId("");
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spentByCat.get(b.categoryName) ?? 0), 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{tr("Budgets · this month")}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Spend")}{" "}<span className="serif-italic text-amber/90">{tr("limits.")}</span>
        </h1>
        {budgets.length > 0 && (
          <p className="mt-3 font-mono text-sm text-ink/45">{tr("{amount} of {amount2} used", { amount: formatCurrency(totalSpent), amount2: formatCurrency(totalBudget) })}</p>
        )}
      </div>

      {/* add budget — category, limit and button each get a full row on phones, one row from sm up */}
      <div className="card mb-6 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="block min-w-0">
          <span className="label mb-1.5 block">{tr("Category")}</span>
          <select
            value={newCatId}
            onChange={(e) => setNewCatId(e.target.value)}
            className="min-h-[44px] w-full cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink/80 outline-hidden focus:border-amber/50"
          >
            {available.length === 0 ? (
              <option value="">{tr("All categories budgeted")}</option>
            ) : (
              available.map((c) => (
                <option key={c.id} value={c.id} className="bg-card">
                  {tr(c.name)}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="label mb-1.5 block">{tr("Monthly limit")}</span>
          <span className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
            <span className="font-mono text-ink/40">{currencySymbol()}</span>
            <input
              inputMode="decimal"
              value={newAmt}
              onChange={(e) => setNewAmt(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="0"
              className="min-h-[44px] w-full min-w-0 bg-transparent font-mono text-sm text-ink outline-hidden"
            />
          </span>
        </label>
        <button
          onClick={add}
          disabled={available.length === 0 || !(parseFloat(newAmt) > 0)}
          className="entry-btn inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40 sm:w-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />{" "}{tr("Set budget")}
        </button>
      </div>

      {!loading && budgets.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-ink/40">
          {tr("No budgets yet. Pick a category and set a monthly limit.")}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {budgets.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          const spent = spentByCat.get(b.categoryName) ?? 0;
          const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
          const over = spent > b.amount;
          const color = over ? "rgb(var(--c-expense))" : vivid(cat?.color ?? "#3D80BC");
          return (
            <div key={b.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CategoryIcon name={b.categoryName} icon={cat?.icon} color={cat?.color ?? "#7A746A"} size="sm" />
                  <span className="text-sm font-medium text-ink/85">{tr(b.categoryName)}</span>
                </div>
                <button
                  onClick={() => removeBudget(b.id)}
                  aria-label={tr("Delete budget")}
                  className="cursor-pointer text-ink/30 transition-colors hover:text-expense"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-ink/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between font-mono text-xs">
                <span className={over ? "text-expense" : "text-ink/55"}>
                  {tr("{amount} spent", { amount: formatCurrency(spent) })}
                </span>
                <span className="flex items-center gap-1 text-ink/40">
                  {tr("of")}
                  <input
                    defaultValue={String(b.amount)}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v > 0 && v !== b.amount) editBudget(b.id, { amount: v });
                    }}
                    inputMode="decimal"
                    aria-label={tr("Edit limit")}
                    className="w-16 rounded-sm border border-transparent bg-transparent text-right text-ink/70 outline-hidden hover:border-line focus:border-amber/50"
                  />
                </span>
              </div>
              {over && <p className="mt-1 font-mono text-[11px] text-expense">{tr("Over by {amount}", { amount: formatCurrency(spent - b.amount) })}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
