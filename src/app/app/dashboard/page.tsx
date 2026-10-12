"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isSameMonth } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, Wallet, Smile, SlidersHorizontal } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { OverlapChart } from "@/components/charts/overlap-chart";
import { RangeControls } from "@/components/charts/range-controls";
import { CategoryDonut } from "@/components/charts/category-donut";
import { MoodDonut } from "@/components/charts/mood-donut";
import { SavingsDonut } from "@/components/charts/savings-donut";
import { CategoryBars } from "@/components/charts/category-bars";
import { MoodTagBars } from "@/components/charts/mood-tag-bars";
import { formatCurrency } from "@/lib/utils";
import { rangeWindow, type Range } from "@/lib/range";
import type { DashboardSectionId } from "@/lib/dashboard-sections";

export default function DashboardPage() {
  const { transactions, moods, categories, loading, dashboardHidden } = useAppData();
  const now = new Date();

  // One period selector drives every chart on the dashboard (set in the top trend chart).
  const [range, setRange] = useState<Range>("month");
  const [offset, setOffset] = useState(0);

  const monthTx = useMemo(
    () => transactions.filter((t) => isSameMonth(new Date(t.occurredOn), now)),
    [transactions],
  );

  const spent = monthTx.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const earned = monthTx.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const saved = earned - spent;
  const savedRate = earned > 0 ? Math.round((saved / earned) * 100) : 0;

  const avgMood = useMemo(() => {
    const month = moods.filter((m) => isSameMonth(new Date(m.loggedOn), now));
    if (!month.length) return 0;
    return Math.round((month.reduce((s, m) => s + m.mood, 0) / month.length) * 10) / 10;
  }, [moods]);

  const tiles = [
    { label: "Spent", value: formatCurrency(spent), icon: ArrowUpRight, tint: "#CB453B" },
    { label: "Earned", value: formatCurrency(earned), icon: ArrowDownLeft, tint: "#2E8159" },
    {
      label: "Saved",
      value: formatCurrency(saved),
      sub: `${savedRate}% rate`,
      icon: Wallet,
      tint: saved >= 0 ? "#3D80BC" : "#CB453B",
    },
    { label: "Avg mood", value: avgMood ? `${avgMood} / 5` : "—", icon: Smile, tint: "#7A4E86" },
  ];

  // Sections hidden in Settings are simply not rendered. Nothing renders until the
  // preference is read, so hidden sections never flash in.
  const show = (id: DashboardSectionId) => dashboardHidden !== null && !dashboardHidden.includes(id);

  const charts: { id: DashboardSectionId; title: string; accent: string; body: React.ReactNode }[] = [
    {
      id: "spent",
      title: "Spent",
      accent: "by category",
      body: <CategoryDonut transactions={transactions} categories={categories} kind="expense" range={range} offset={offset} />,
    },
    {
      id: "earned",
      title: "Earned",
      accent: "by category",
      body: <CategoryDonut transactions={transactions} categories={categories} kind="income" range={range} offset={offset} />,
    },
    {
      id: "mood",
      title: "Mood",
      accent: "distribution",
      body: <MoodDonut moods={moods} range={range} offset={offset} />,
    },
    {
      id: "savings",
      title: "Savings",
      accent: "added vs broken",
      body: <SavingsDonut transactions={transactions} range={range} offset={offset} />,
    },
    {
      id: "moodTags",
      title: "Mood was about",
      accent: "frequency",
      body: <MoodTagBars moods={moods} range={range} offset={offset} />,
    },
    {
      id: "categories",
      title: "Category",
      accent: "frequency",
      body: <CategoryBars transactions={transactions} categories={categories} range={range} offset={offset} />,
    },
  ];
  const visibleCharts = charts.filter((c) => show(c.id));
  const nothingShown = dashboardHidden !== null && !show("kpis") && !show("trend") && visibleCharts.length === 0;

  return (
    <div className="px-4 pb-6 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="mb-4 lg:mb-6">
        <div className="mb-1 flex items-center justify-between gap-3 lg:mb-2">
          <span className="label">Dashboard · this month</span>
          <Link
            href="/app/settings#dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/40 transition-colors hover:text-amber"
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            Customize
          </Link>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
          The month <span className="serif-italic text-amber/90">so far.</span>
        </h1>
      </div>

      {/* KPI row — 2×2 on phones, one row from sm up */}
      {show("kpis") && (
        <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 lg:mb-6 lg:rounded-2xl">
          {tiles.map(({ label, value, sub, icon: Icon, tint }) => (
            <div key={label} className="min-w-0 bg-card px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="flex items-center justify-between">
                <span className="label text-[10px]">{label}</span>
                <Icon className="h-3.5 w-3.5" style={{ color: tint }} aria-hidden />
              </div>
              <div className="mt-1 flex items-baseline gap-x-1.5 whitespace-nowrap">
                <span className="shrink-0 font-mono text-base font-semibold tabular text-ink sm:text-xl">{value}</span>
                {sub && <span className="min-w-0 truncate font-mono text-[10px] text-ink/35">{sub}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trend (full width) — owns the single period selector for all charts */}
      {show("trend") ? (
        <div className="card mb-4 p-3 sm:p-6 lg:mb-6">
          <OverlapChart
            transactions={transactions}
            moods={moods}
            range={range}
            offset={offset}
            setRange={setRange}
            setOffset={setOffset}
          />
        </div>
      ) : (
        visibleCharts.length > 0 && (
          // Trend hidden: the period selector still needs a home.
          <div className="card mb-4 p-3 sm:p-4 lg:mb-6">
            <div className="label mb-2">Period · {rangeWindow(range, offset).label}</div>
            <RangeControls range={range} setRange={setRange} offset={offset} setOffset={setOffset} />
          </div>
        )
      )}

      {/* Donuts + frequency bars, two per row on desktop; hidden ones close the gap. */}
      {visibleCharts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          {visibleCharts.map((c) => (
            <ChartCard key={c.id} title={c.title} accent={c.accent}>
              {c.body}
            </ChartCard>
          ))}
        </div>
      )}

      {nothingShown && (
        <div className="card px-6 py-12 text-center text-sm text-ink/40">
          Every dashboard section is hidden.{" "}
          <Link href="/app/settings#dashboard" className="text-amber hover:underline">
            Choose what to show
          </Link>{" "}
          — your data is all still there.
        </div>
      )}

      {loading && <p className="mt-4 text-center font-mono text-xs text-ink/30">Loading…</p>}
    </div>
  );
}

function ChartCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4 sm:p-6">
      <h2 className="mb-3 font-display text-lg font-semibold text-ink sm:mb-4 sm:text-xl">
        {title} <span className="serif-italic text-amber/90">{accent}</span>
      </h2>
      {children}
    </div>
  );
}
