"use client";

import { useMemo } from "react";
import { isSameMonth } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, Wallet, Smile } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { OverlapChart } from "@/components/charts/overlap-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { MoodDonut } from "@/components/charts/mood-donut";
import { SavingsDonut } from "@/components/charts/savings-donut";
import { CategoryBars } from "@/components/charts/category-bars";
import { MoodTagBars } from "@/components/charts/mood-tag-bars";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { transactions, moods, categories, loading } = useAppData();
  const now = new Date();

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

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">Dashboard · this month</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          The month <span className="serif-italic text-amber/90">so far.</span>
        </h1>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {tiles.map(({ label, value, sub, icon: Icon, tint }) => (
          <div key={label} className="bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="label">{label}</span>
              <Icon className="h-4 w-4" style={{ color: tint }} aria-hidden />
            </div>
            <div className="mt-3 font-mono text-2xl font-semibold tabular text-ink">{value}</div>
            {sub && <div className="mt-0.5 font-mono text-[11px] text-ink/35">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Trend (full width) */}
      <div className="card mb-6 p-6">
        <OverlapChart transactions={transactions} moods={moods} />
      </div>

      {/* Money donuts: Spent + Earned */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Spent" accent="by category">
          <CategoryDonut transactions={transactions} categories={categories} kind="expense" />
        </ChartCard>
        <ChartCard title="Earned" accent="by category">
          <CategoryDonut transactions={transactions} categories={categories} kind="income" />
        </ChartCard>
      </div>

      {/* Mood donut + Savings donut */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Mood" accent="distribution">
          <MoodDonut moods={moods} />
        </ChartCard>
        <ChartCard title="Savings" accent="added vs broken">
          <SavingsDonut transactions={transactions} />
        </ChartCard>
      </div>

      {/* Mood tag frequency + Category frequency side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Mood was about" accent="frequency">
          <MoodTagBars moods={moods} />
        </ChartCard>
        <ChartCard title="Category" accent="frequency">
          <CategoryBars transactions={transactions} categories={categories} />
        </ChartCard>
      </div>

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
    <div className="card p-6">
      <h2 className="mb-4 font-display text-xl font-semibold text-ink">
        {title} <span className="serif-italic text-amber/90">{accent}</span>
      </h2>
      {children}
    </div>
  );
}
