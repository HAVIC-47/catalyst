"use client";

import { useMemo, useState } from "react";
import { isSameMonth } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { TAKA, cn, formatCurrency } from "@/lib/utils";

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
        <div className="label mb-2">Budgets · this month</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          Spend <span className="serif-italic text-amber/90">limits.</span>
        </h1>
        {budgets.length > 0 && (
          <p className="mt-3 font-mono text-sm text-ink/45">
            {formatCurrency(totalSpent)} of {formatCurrency(totalBudget)} used
          </p>
        )}
      </div>

      {/* add budget */}
      <div className="card mb-6 flex flex-wrap items-center gap-2 p-4">
        <select
          value={newCatId}
          onChange={(e) => setNewCatId(e.target.value)}
          aria-label="Category"
          className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink/80 outline-none focus:border-amber/50"
        >
          {available.length === 0 ? (
            <option value="">All categories budgeted</option>
          ) : (
            available.map((c) => (
              <option key={c.id} value={c.id} className="bg-card">
                {c.name}
              </option>
            ))
          )}
        </select>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
          <span className="font-mono text-ink/40">{TAKA}</span>
          <input
            inputMode="decimal"
            value={newAmt}
            onChange={(e) => setNewAmt(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Monthly limit"
            aria-label="Monthly limit"
            className="min-h-[44px] w-full bg-transparent font-mono text-sm text-ink outline-none"
          />
        </div>
        <button
          onClick={add}
          disabled={available.length === 0 || !(parseFloat(newAmt) > 0)}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Set budget
        </button>
      </div>

      {!loading && budgets.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-ink/40">
          No budgets yet. Pick a category and set a monthly limit.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {budgets.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          const spent = spentByCat.get(b.categoryName) ?? 0;
          const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
          const over = spent > b.amount;
          const color = over ? "#CB453B" : cat?.color ?? "#3D80BC";
          return (
            <div key={b.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                    style={{ backgroundColor: `${cat?.color ?? "#7A746A"}22`, color: cat?.color ?? "#7A746A" }}
                  >
                    {b.categoryName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-ink/85">{b.categoryName}</span>
                </div>
                <button
                  onClick={() => removeBudget(b.id)}
                  aria-label="Delete budget"
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
                  {formatCurrency(spent)} spent
                </span>
                <span className="flex items-center gap-1 text-ink/40">
                  of
                  <input
                    defaultValue={String(b.amount)}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v > 0 && v !== b.amount) editBudget(b.id, { amount: v });
                    }}
                    inputMode="decimal"
                    aria-label="Edit limit"
                    className="w-16 rounded border border-transparent bg-transparent text-right text-ink/70 outline-none hover:border-line focus:border-amber/50"
                  />
                </span>
              </div>
              {over && <p className="mt-1 font-mono text-[11px] text-expense">Over by {formatCurrency(spent - b.amount)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
