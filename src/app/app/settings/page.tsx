"use client";

import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, type Kind } from "@/types";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard-sections";
import { cn, tintText } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";

const SWATCHES = [
  "#C06A33", "#2E8159", "#3D80BC", "#7A4E86", "#B59A3C", "#3D80BC",
  "#CB453B", "#4C5B82", "#8E5B6E", "#A6694A", "#2F6F6B", "#7A4E86", "#7A746A",
];

export default function SettingsPage() {
  const { categories } = useAppData();
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">Settings</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          Make it <span className="serif-italic text-amber/90">yours.</span>
        </h1>
      </div>

      <DashboardSections />

      <div className="mb-4 mt-10">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Your <span className="serif-italic text-amber/90">categories.</span>
        </h2>
        <p className="mt-1 max-w-lg text-sm text-ink/45">
          Add, rename, recolor, or remove categories for expenses and income. Deleting one keeps
          past transactions labeled.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategorySection kind="expense" />
        <CategorySection kind="income" />
      </div>

      {categories.length === 0 && (
        <p className="mt-4 font-mono text-xs text-ink/30">Loading categories…</p>
      )}
    </div>
  );
}

// Show / hide each of the dashboard's sections. Hiding never touches data.
function DashboardSections() {
  const { dashboardHidden, setDashboardHidden } = useAppData();
  const hidden = dashboardHidden ?? [];
  const shownCount = DASHBOARD_SECTIONS.length - hidden.length;

  return (
    <section id="dashboard" className="card scroll-mt-20 p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          Dashboard <span className="serif-italic text-amber/90">sections</span>
        </h2>
        <div className="flex items-center gap-3">
          {hidden.length > 0 && (
            <button
              onClick={() => setDashboardHidden([])}
              className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 transition-colors hover:text-amber"
            >
              Show all
            </button>
          )}
          <span className="label">
            {shownCount} / {DASHBOARD_SECTIONS.length}
          </span>
        </div>
      </div>
      <p className="mb-4 max-w-lg text-sm text-ink/45">
        Choose what the dashboard shows. Hidden sections keep all their data — it&apos;s still
        recorded and comes back the moment you turn the section on.
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {DASHBOARD_SECTIONS.map((s) => {
          const on = !hidden.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={dashboardHidden === null}
                onClick={() =>
                  setDashboardHidden(on ? [...hidden, s.id] : hidden.filter((id) => id !== s.id))
                }
                className={cn(
                  "flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 disabled:cursor-default disabled:opacity-50",
                  on ? "border-line bg-ink/[0.02] hover:bg-ink/[0.04]" : "border-dashed border-line hover:bg-ink/[0.02]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", on ? "text-ink/85" : "text-ink/45")}>{s.label}</span>
                  <span className="block truncate text-[11px] text-ink/35">{s.hint}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    on ? "bg-amber/70" : "bg-ink/20",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-xs transition-all",
                      on ? "left-[18px]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CategorySection({ kind }: { kind: Kind }) {
  const { categories, createCategory, editCategory, removeCategory } = useAppData();
  const list = categories.filter((c) => c.kind === kind);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [adding, setAdding] = useState(false);

  const add = async () => {
    const n = name.trim();
    if (!n || adding) return;
    setAdding(true);
    try {
      await createCategory({ name: n, kind, color, sort: list.length });
      setName("");
    } finally {
      setAdding(false);
    }
  };

  const restoreDefaults = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const defaults = kind === "expense" ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
      const have = new Set(list.map((c) => c.name.toLowerCase()));
      let i = list.length;
      for (const d of defaults) {
        if (have.has(d.name.toLowerCase())) continue;
        await createCategory({ name: d.name, kind, color: d.color, sort: i++ });
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card min-w-0 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold capitalize text-ink">{kind}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={restoreDefaults}
            disabled={adding}
            className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 transition-colors hover:text-amber disabled:opacity-40"
          >
            Restore defaults
          </button>
          <span className="label">{list.length}</span>
        </div>
      </div>

      <ul className="mb-4 space-y-2">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink/[0.02] p-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ backgroundColor: `${c.color}22`, color: tintText(c.color) }}
            >
              {c.name.slice(0, 1).toUpperCase()}
            </span>
            <input
              defaultValue={c.name}
              maxLength={LIMITS.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) editCategory(c.id, { name: v });
              }}
              aria-label={`Rename ${c.name}`}
              className="w-0 min-w-0 flex-1 bg-transparent text-sm text-ink/85 outline-hidden focus:text-ink"
            />
            <div className="flex items-center gap-1">
              {SWATCHES.slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => editCategory(c.id, { color: s })}
                  aria-label={`Set color ${s}`}
                  className="h-4 w-4 cursor-pointer rounded-full ring-offset-1 ring-offset-card transition-transform hover:scale-125"
                  style={{ backgroundColor: s, boxShadow: c.color === s ? `0 0 0 2px ${s}` : undefined }}
                />
              ))}
            </div>
            <button
              onClick={() => removeCategory(c.id)}
              aria-label={`Delete ${c.name}`}
              className="cursor-pointer rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-ink/5 hover:text-expense"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {/* add new */}
      <div className="rounded-xl border border-dashed border-line p-3">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={`New ${kind} category`}
            maxLength={LIMITS.name}
            aria-label={`New ${kind} category name`}
            className="min-h-[40px] w-0 min-w-0 flex-1 rounded-lg border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50"
          />
          <button
            onClick={add}
            disabled={!name.trim() || adding}
            aria-label="Add category"
            className="entry-btn flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-paper disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              onClick={() => setColor(s)}
              aria-label={`Pick color ${s}`}
              className={cn(
                "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110",
              )}
              style={{ backgroundColor: s }}
            >
              {color === s && <Check className="h-3.5 w-3.5 text-paper" aria-hidden strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
