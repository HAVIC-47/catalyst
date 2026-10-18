"use client";

// Net worth over time (a dashboard section): what's in the wallets plus dhar owed
// to you, minus dhar you owe — at the end of each month, and today.
import { useMemo } from "react";
import Link from "next/link";
import { parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppData } from "@/hooks/use-app-data";
import { netWorthSeries } from "@/lib/networth";
import { cn, compactCurrency, fmt, formatCurrency, toDateKey } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export function NetWorthCard({ className }: { className?: string }) {
  const { wallets, transactions, debts, debtPayments, walletsReady } = useAppData();
  const today = toDateKey(new Date());
  const series = useMemo(
    () => netWorthSeries(today, 12, wallets, transactions, debts, debtPayments),
    [today, wallets, transactions, debts, debtPayments],
  );
  if (!walletsReady || wallets.length === 0) return null;
  const now = series[series.length - 1];
  const before = series.length > 1 ? series[series.length - 2] : null;
  const change = before ? now.total - before.total : 0;
  const data = series.map((p, i) => ({
    label: i === series.length - 1 ? tr("Now") : fmt(parseISO(p.date), "MMM"),
    total: p.total,
    date: p.date,
  }));

  return (
    <section className={cn("card p-4 sm:p-6", className)} aria-label={tr("Net worth")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">
            {tr("Net worth")} <span className="serif-italic text-amber/90">{tr("over time")}</span>
          </h2>
          <div className={cn("mt-1 font-mono text-2xl font-semibold tabular sm:text-3xl", now.total < 0 ? "text-expense" : "text-ink")}>
            {formatCurrency(now.total)}
          </div>
          {before && (
            <div className={cn("font-mono text-[11px]", change >= 0 ? "text-income" : "text-expense")}>
              {tr("{amount} since the end of {month}", { amount: formatCurrency(change, { sign: true }), month: fmt(parseISO(before.date), "MMMM") })}
            </div>
          )}
        </div>
        <Link href="/app/wallets" className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-ink/45 hover:text-amber">
          <span>{tr("Wallets {amount}", { amount: formatCurrency(now.cash) })}</span>
          {now.owedToYou > 0 && <span>{tr("Owed to you {amount}", { amount: formatCurrency(now.owedToYou) })}</span>}
          {now.youOwe > 0 && <span>{tr("You owe {amount}", { amount: formatCurrency(now.youOwe) })}</span>}
        </Link>
      </div>
      {data.length > 1 ? (
        <div className="mt-4 h-44 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3D80BC" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3D80BC" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-ink) / 0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--c-ink) / 0.45)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis
                width={52}
                tick={{ fontSize: 10, fill: "rgb(var(--c-ink) / 0.45)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => compactCurrency(v)}
              />
              <Tooltip
                cursor={{ stroke: "rgb(var(--c-ink) / 0.2)" }}
                contentStyle={{ background: "rgb(var(--c-card))", border: "1px solid rgb(var(--c-ink) / 0.12)", borderRadius: 12, fontSize: 12 }}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date as string | undefined;
                  return d ? fmt(parseISO(d), "MMM d, yyyy") : "";
                }}
                formatter={(v: number) => [formatCurrency(v), tr("Net worth")]}
              />
              <Area type="monotone" dataKey="total" stroke="#3D80BC" strokeWidth={2} fill="url(#nw-fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/40">{tr("The chart fills in month by month.")}</p>
      )}
    </section>
  );
}
