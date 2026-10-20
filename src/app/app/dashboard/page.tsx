"use client";

import { Fragment, useMemo, useState } from "react";
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
import { AiInsights } from "@/components/ai/ai-insights";
import { NetWorthCard } from "@/components/dashboard/net-worth";
import { HabitsStrip } from "@/components/dashboard/habits-strip";
import { cn, formatCurrency } from "@/lib/utils";
import { walletBalances } from "@/lib/money";
import { rangeWindow, type Range } from "@/lib/range";
import type { DashboardSectionId } from "@/lib/dashboard-sections";
import { tr, digits } from "@/lib/i18n";

export default function DashboardPage() {
  const { transactions, moods, categories, loading, dashboardHidden, dashboardOrder } = useAppData();
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
    { label: tr("Spent"), value: formatCurrency(spent), icon: ArrowUpRight, tint: "rgb(var(--c-expense))" },
    { label: tr("Earned"), value: formatCurrency(earned), icon: ArrowDownLeft, tint: "rgb(var(--c-income))" },
    {
      label: tr("Saved"),
      value: formatCurrency(saved),
      sub: tr("{savedRate}% rate", { savedRate }),
      icon: Wallet,
      tint: saved >= 0 ? "rgb(var(--c-saving))" : "rgb(var(--c-expense))",
    },
    { label: tr("Avg mood"), value: avgMood ? digits(`${avgMood} / 5`) : "—", icon: Smile, tint: "rgb(var(--c-violet))" },
  ];

  // Sections hidden in Settings are simply not rendered. Nothing renders until the
  // preference is read, so hidden sections never flash in.
  const show = (id: DashboardSectionId) => dashboardHidden !== null && !dashboardHidden.includes(id);

  const charts: { id: DashboardSectionId; title: string; accent: string; body: React.ReactNode }[] = [
    {
      id: "spent",
      title: tr("Spent"),
      accent: tr("by category"),
      body: <CategoryDonut transactions={transactions} categories={categories} kind="expense" range={range} offset={offset} />,
    },
    {
      id: "earned",
      title: tr("Earned"),
      accent: tr("by category"),
      body: <CategoryDonut transactions={transactions} categories={categories} kind="income" range={range} offset={offset} />,
    },
    {
      id: "mood",
      title: tr("Mood"),
      accent: tr("distribution"),
      body: <MoodDonut moods={moods} range={range} offset={offset} />,
    },
    {
      id: "savings",
      title: tr("Savings"),
      accent: tr("added vs broken"),
      body: <SavingsDonut transactions={transactions} range={range} offset={offset} />,
    },
    {
      id: "moodTags",
      title: tr("Mood was about"),
      accent: tr("frequency"),
      body: <MoodTagBars moods={moods} range={range} offset={offset} />,
    },
    {
      id: "categories",
      title: tr("Category"),
      accent: tr("frequency"),
      body: <CategoryBars transactions={transactions} categories={categories} range={range} offset={offset} />,
    },
  ];
  const nothingShown = dashboardHidden !== null && dashboardOrder.every((id) => !show(id));
  // The recap opens on last month during the first week of a month.
  const recapOffset = now.getDate() <= 7 ? -1 : 0;

  const kpis = (
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
  );

  const section = (id: DashboardSectionId): React.ReactNode => {
    switch (id) {
      case "kpis":
        return kpis;
      case "trend":
        // Owns the one period selector every chart follows.
        return (
          <div className="card mb-4 p-3 sm:p-6 lg:mb-6">
            <OverlapChart transactions={transactions} moods={moods} range={range} offset={offset} setRange={setRange} setOffset={setOffset} />
          </div>
        );
      case "wallets":
        return <WalletStrip />;
      case "netWorth":
        return <NetWorthCard className="mb-4 lg:mb-6" />;
      case "habits":
        return <HabitsStrip className="mb-4 lg:mb-6" />;
      case "recap":
        // The month (or year) in one AI read, with what to do differently next time.
        return <AiInsights topics={["recap"]} periods={["month", "year"]} defaultPeriod="month" defaultOffset={recapOffset} className="mb-4 lg:mb-6" />;
      case "insights":
        // AI read of mood, money and savings — its own period selector (week / month / year).
        return <AiInsights topics={["mood", "ledger", "savings"]} className="mb-4 lg:mb-6" />;
      default:
        return null;
    }
  };

  // The sections in the user's order (Settings → Dashboard). Charts that follow one
  // another share a grid, two per row on desktop; when the trend is hidden, the
  // period selector comes right before the first chart.
  const blocks: React.ReactNode[] = [];
  let run: typeof charts = [];
  let periodShown = show("trend");
  const flush = () => {
    if (!run.length) return;
    if (!periodShown) {
      periodShown = true;
      blocks.push(
        <div key="period" className="card mb-4 p-3 sm:p-4 lg:mb-6">
          <div className="label mb-2">{tr("Period · {x}", { x: rangeWindow(range, offset).label })}</div>
          <RangeControls range={range} setRange={setRange} offset={offset} setOffset={setOffset} />
        </div>,
      );
    }
    blocks.push(
      <div key={`charts-${run[0].id}`} className="mb-4 grid gap-4 lg:mb-6 lg:grid-cols-2 lg:gap-6">
        {run.map((c) => (
          <ChartCard key={c.id} title={c.title} accent={c.accent}>
            {c.body}
          </ChartCard>
        ))}
      </div>,
    );
    run = [];
  };
  for (const id of dashboardOrder) {
    if (!show(id)) continue;
    const chart = charts.find((c) => c.id === id);
    if (chart) {
      run.push(chart);
      continue;
    }
    flush();
    blocks.push(<Fragment key={id}>{section(id)}</Fragment>);
  }
  flush();

  return (
    <div className="px-4 pb-6 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="mb-4 lg:mb-6">
        <div className="mb-1 flex items-center justify-between gap-3 lg:mb-2">
          <span className="label">{tr("Dashboard · this month")}</span>
          <Link
            href="/app/settings/dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/40 transition-colors hover:text-amber"
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            {tr("Customize")}
          </Link>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
          {tr("The month")}{" "}<span className="serif-italic text-amber/90">{tr("so far.")}</span>
        </h1>
      </div>

      {blocks}

      {nothingShown && (
        <div className="card px-6 py-12 text-center text-sm text-ink/40">
          {tr("Every dashboard section is hidden.")}{" "}
          <Link href="/app/settings/dashboard" className="text-amber hover:underline">
            {tr("Choose what to show")}
          </Link>{" "}
          {tr("— your data is all still there.")}
        </div>
      )}

      {loading && <p className="mt-4 text-center font-mono text-xs text-ink/30">{tr("Loading…")}</p>}
    </div>
  );
}

/** What's in each wallet right now. */
function WalletStrip() {
  const { wallets, transactions, transfers, debts, debtPayments, walletsReady } = useAppData();
  const live = wallets.filter((w) => !w.archived);
  const balances = useMemo(
    () => walletBalances(wallets, transactions, transfers, debts, debtPayments),
    [wallets, transactions, transfers, debts, debtPayments],
  );
  if (!walletsReady || live.length === 0) return null;
  return (
    <Link
      href="/app/wallets"
      aria-label={tr("Wallet balances")}
      className="card mb-4 flex gap-px overflow-x-auto p-0 transition-colors hover:border-ink/20 lg:mb-6"
    >
      {live.map((w) => {
        const b = balances.get(w.id) ?? 0;
        return (
          <div key={w.id} className="min-w-[132px] flex-1 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} aria-hidden />
              <span className="label truncate text-[10px]">{tr(w.name)}</span>
            </div>
            <div className={cn("mt-1 whitespace-nowrap font-mono text-base font-semibold tabular", b < 0 ? "text-expense" : "text-ink")}>
              {formatCurrency(b)}
            </div>
          </div>
        );
      })}
    </Link>
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
