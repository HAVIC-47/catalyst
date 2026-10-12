"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, Trash2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { useDebounce } from "@/hooks/use-debounce";
import type { Kind, Transaction } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { inRange, rangeWindow, type Range } from "@/lib/range";

type KindFilter = "all" | Kind;
type PeriodFilter = "all" | Range | "custom";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "saving", label: "Saving" },
];

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];

const amountOrNull = (s: string) => {
  const n = Number(s);
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

export default function TransactionsPage() {
  const { transactions, categories, removeMoney, openEntry, loading } = useAppData();
  const colorOf = useMemo(
    () => new Map(categories.map((c) => [c.name, c.color])),
    [categories],
  );

  // search + filters
  const [query, setQuery] = useState("");
  const q = useDebounce(query, 150);
  const [showFilters, setShowFilters] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");

  const activeFilters =
    (kind !== "all" ? 1 : 0) +
    (period !== "all" ? 1 : 0) +
    (category ? 1 : 0) +
    (minAmt.trim() || maxAmt.trim() ? 1 : 0);
  const filtering = activeFilters > 0 || q.trim() !== "";

  const resetFilters = () => {
    setKind("all");
    setPeriod("all");
    setFrom("");
    setTo("");
    setCategory("");
    setMinAmt("");
    setMaxAmt("");
  };
  const clearAll = () => {
    resetFilters();
    setQuery("");
  };

  // Searchable text per transaction: note, category, place, kind, amount (raw and
  // grouped, e.g. "13000" and "13,000") and the spelled-out date ("monday october 12").
  const haystacks = useMemo(() => {
    const grouped = new Intl.NumberFormat("en-IN");
    return new Map(
      transactions.map((t) => [
        t.id,
        [
          t.note,
          t.categoryName,
          t.place,
          t.kind,
          String(t.amount),
          grouped.format(t.amount),
          format(parseISO(t.occurredOn), "EEEE MMMM d yyyy"),
        ]
          .join(" ")
          .toLowerCase(),
      ]),
    );
  }, [transactions]);

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const c of categories) if (kind === "all" || c.kind === kind) names.add(c.name);
    for (const t of transactions) if (kind === "all" || t.kind === kind) names.add(t.categoryName);
    if (category) names.add(category);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [categories, transactions, kind, category]);

  const filtered = useMemo(() => {
    // Every word must match somewhere ("food dhaka" = food AND dhaka).
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let win: { startKey: string; endKey: string } | null = null;
    if (period === "custom") {
      if (from || to) {
        const [a, b] = from && to && from > to ? [to, from] : [from, to];
        win = { startKey: a || "0000-01-01", endKey: b || "9999-12-31" };
      }
    } else if (period !== "all") {
      win = rangeWindow(period, 0);
    }
    const min = amountOrNull(minAmt);
    const max = amountOrNull(maxAmt);
    return transactions.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (category && t.categoryName !== category) return false;
      if (win && !inRange(t.occurredOn, win.startKey, win.endKey)) return false;
      if (min !== null && t.amount < min) return false;
      if (max !== null && t.amount > max) return false;
      if (words.length) {
        const hay = haystacks.get(t.id) ?? "";
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [transactions, haystacks, q, kind, category, period, from, to, minAmt, maxAmt]);

  const totals = useMemo(() => {
    let income = 0,
      expense = 0,
      saving = 0;
    for (const t of filtered) {
      if (t.kind === "income") income += t.amount;
      else if (t.kind === "expense") expense += t.amount;
      else saving += t.amount;
    }
    return { income, expense, saving, net: income - expense };
  }, [filtered]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of filtered) {
      (m.get(t.occurredOn) ?? m.set(t.occurredOn, []).get(t.occurredOn)!).push(t);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Ledger · {transactions.length} total</div>
          <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Trans<span className="serif-italic text-amber/90">actions.</span>
          </h1>
        </div>
        <button
          onClick={() => openEntry({ tab: "money" })}
          className="entry-btn min-h-[42px] cursor-pointer rounded-xl px-4 text-sm font-semibold text-paper shadow-entry"
        >
          + Add
        </button>
      </div>

      {/* Search + filter toggle */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search note, category, place, amount, date…"
            aria-label="Search transactions"
            className="min-h-[42px] w-full rounded-xl border border-line bg-card pl-9 pr-9 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-amber/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-controls="ledger-filters"
          aria-label="Filters"
          className={cn(
            "inline-flex min-h-[42px] shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors duration-200",
            showFilters || activeFilters > 0
              ? "border-amber/40 bg-amber/[0.08] text-amber"
              : "border-line text-ink/60 hover:bg-ink/[0.04] hover:text-ink",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {activeFilters > 0 && (
            <span className="entry-btn rounded-full px-1.5 font-mono text-[10px] leading-4">{activeFilters}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div id="ledger-filters" className="card mb-4 space-y-4 p-4 sm:p-5">
          <FilterRow label="Type">
            <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
          </FilterRow>

          <FilterRow label="Period">
            <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            {period === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="From date"
                  className={cn(fieldCls, "w-0 min-w-0 flex-1")}
                />
                <span className="text-ink/30">–</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="To date"
                  className={cn(fieldCls, "w-0 min-w-0 flex-1")}
                />
              </div>
            )}
          </FilterRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FilterRow label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Category"
                className={cn(fieldCls, "w-full cursor-pointer")}
              >
                <option value="">All categories</option>
                {categoryOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FilterRow>

            <FilterRow label="Amount (৳)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={minAmt}
                  onChange={(e) => setMinAmt(e.target.value)}
                  placeholder="Min"
                  aria-label="Minimum amount"
                  className={cn(fieldCls, "w-0 min-w-0 flex-1")}
                />
                <span className="text-ink/30">–</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={maxAmt}
                  onChange={(e) => setMaxAmt(e.target.value)}
                  placeholder="Max"
                  aria-label="Maximum amount"
                  className={cn(fieldCls, "w-0 min-w-0 flex-1")}
                />
              </div>
            </FilterRow>
          </div>

          {activeFilters > 0 && (
            <div className="flex justify-end border-t border-line pt-3">
              <button
                onClick={resetFilters}
                className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 transition-colors hover:text-amber"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* What the current search / filters add up to */}
      {filtering && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular">
          <span className="text-ink/55">
            {filtered.length} of {transactions.length}
          </span>
          {totals.income > 0 && <span className="text-income">In {formatCurrency(totals.income)}</span>}
          {totals.expense > 0 && <span className="text-expense">Out {formatCurrency(totals.expense)}</span>}
          {totals.saving > 0 && <span className="text-saving">Saved {formatCurrency(totals.saving)}</span>}
          <span className={cn(totals.net >= 0 ? "text-income" : "text-expense")}>
            Net {formatCurrency(totals.net, { sign: true })}
          </span>
          <button
            onClick={clearAll}
            className="ml-auto cursor-pointer uppercase tracking-widest text-amber/80 transition-colors hover:text-amber"
          >
            Clear
          </button>
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-ink/40">
          No transactions yet. Hit <span className="text-ink/70">+ Add</span> or click a calendar day.
        </div>
      )}

      {!loading && transactions.length > 0 && filtered.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-ink/40">
          Nothing matches.{" "}
          <button onClick={clearAll} className="cursor-pointer text-amber hover:underline">
            Clear search &amp; filters
          </button>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(([date, items]) => {
          const dayIncome = items.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
          const dayExpense = items.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
          const daySaving = items.filter((t) => t.kind === "saving").reduce((s, t) => s + t.amount, 0);
          const dayNet = dayIncome - dayExpense;
          return (
            <div key={date} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
                <span className="font-mono text-xs uppercase tracking-widest text-ink/45">
                  {format(parseISO(date), "EEE · MMM d, yyyy")}
                </span>
                <div className="flex items-center gap-3 font-mono text-xs tabular">
                  {dayIncome > 0 && (
                    <span className="text-income">In {formatCurrency(dayIncome)}</span>
                  )}
                  {dayExpense > 0 && (
                    <span className="text-expense">Out {formatCurrency(dayExpense)}</span>
                  )}
                  {daySaving > 0 && (
                    <span className="text-saving">Saved {formatCurrency(daySaving)}</span>
                  )}
                  <span className="text-ink/30">·</span>
                  <span className={cn(dayNet >= 0 ? "text-income" : "text-expense")}>
                    Net {formatCurrency(dayNet, { sign: true })}
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {items.map((t) => {
                  const Icon = t.kind === "income" ? ArrowDownLeft : ArrowUpRight;
                  const color = colorOf.get(t.categoryName) ?? "#7A746A";
                  return (
                    <li key={t.id} className="group flex items-center gap-3 px-5 py-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {t.categoryName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink/85">
                          {t.note || t.categoryName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-ink/40">
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
                      <span className={cn("font-mono text-sm tabular", t.kind === "income" ? "text-income" : "text-ink/80")}>
                        {formatCurrency(t.kind === "income" ? t.amount : -t.amount, { sign: true })}
                      </span>
                      <button
                        onClick={() => removeMoney(t.id)}
                        aria-label="Delete"
                        className="cursor-pointer text-ink/0 transition-colors group-hover:text-ink/30 hover:!text-expense"
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

const fieldCls =
  "min-h-[38px] rounded-lg border border-line bg-card px-2.5 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-amber/50";

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label mb-2">{label}</div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-[34px] cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors duration-200",
            value === o.value
              ? "border-amber/40 bg-amber/[0.08] text-amber"
              : "border-line text-ink/55 hover:bg-ink/[0.03] hover:text-ink/80",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
