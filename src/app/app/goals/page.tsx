"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Coins } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { TAKA, formatCurrency } from "@/lib/utils";

export default function GoalsPage() {
  const { goals, createGoal, editGoal, removeGoal, loading } = useAppData();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [due, setDue] = useState("");

  const add = async () => {
    const t = parseFloat(target);
    if (!title.trim() || !(t > 0)) return;
    await createGoal({ title: title.trim(), targetAmount: t, savedAmount: 0, dueOn: due || null });
    setTitle("");
    setTarget("");
    setDue("");
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">Goals · {goals.length}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          Saving <span className="serif-italic text-amber/90">targets.</span>
        </h1>
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-2 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Goal (e.g. New laptop)"
          aria-label="Goal title"
          className="min-h-[44px] flex-1 rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-none focus:border-amber/50"
        />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
          <span className="font-mono text-ink/40">{TAKA}</span>
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Target"
            aria-label="Target amount"
            className="min-h-[44px] w-28 bg-transparent font-mono text-sm text-ink outline-none"
          />
        </div>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Due date"
          className="min-h-[44px] rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink/70 outline-none focus:border-amber/50 [color-scheme:dark]"
        />
        <button
          onClick={add}
          disabled={!title.trim() || !(parseFloat(target) > 0)}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Add
        </button>
      </div>

      {!loading && goals.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-ink/40">
          No goals yet. What are you saving toward?
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((g) => {
          const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
          const done = g.savedAmount >= g.targetAmount;
          return (
            <div key={g.id} className="card p-5">
              <div className="mb-1 flex items-start justify-between">
                <h3 className="font-display text-xl font-semibold text-ink">{g.title}</h3>
                <button
                  onClick={() => removeGoal(g.id)}
                  aria-label="Delete goal"
                  className="cursor-pointer text-ink/30 transition-colors hover:text-expense"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {g.dueOn && (
                <p className="mb-3 font-mono text-[11px] text-ink/35">
                  due {format(parseISO(g.dueOn), "MMM d, yyyy")}
                </p>
              )}

              <div className="h-2.5 overflow-hidden rounded-full bg-ink/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: done ? "#2F6B4E" : "#34618A" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-sm">
                <span className="text-ink/70">{formatCurrency(g.savedAmount)}</span>
                <span className="text-ink/40">/ {formatCurrency(g.targetAmount)}</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <AddSaving onAdd={(amt) => editGoal(g.id, { savedAmount: Math.max(0, g.savedAmount + amt) })} />
                {done && <span className="font-mono text-[11px] text-income">Reached 🎉</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddSaving({ onAdd }: { onAdd: (amt: number) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-line bg-ink/[0.02] px-2 focus-within:border-amber/50">
        <span className="font-mono text-xs text-ink/40">{TAKA}</span>
        <input
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value.replace(/[^0-9.-]/g, ""))}
          placeholder="+ add"
          aria-label="Add savings"
          className="min-h-[36px] w-20 bg-transparent font-mono text-xs text-ink outline-none"
        />
      </div>
      <button
        onClick={() => {
          const n = parseFloat(v);
          if (n) onAdd(n);
          setV("");
        }}
        className="hairline flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-income transition-colors hover:bg-ink/5"
        aria-label="Add to goal"
      >
        <Coins className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
