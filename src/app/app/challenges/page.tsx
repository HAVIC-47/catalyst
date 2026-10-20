"use client";

// Streaks and challenges. The streak counts days with something logged by hand
// (an entry or a mood); a challenge runs for a few days — no-spend days, spending
// under an amount, skipping a category, saving an amount, logging every day — and
// its progress comes from the entries (lib/habits.ts, shared with the app).
// Notifications for milestones, wins and last days follow Settings → Notifications.
import { useMemo, useState } from "react";
import Link from "next/link";
import { parseISO } from "date-fns";
import { Flame, Plus, RotateCcw, Trash2, Trophy } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { Challenge, ChallengeKind } from "@/types";
import {
  CHALLENGE_KINDS,
  challengeProgress,
  challengeTitle,
  loggedDays,
  moodSpendPattern,
  streakOf,
  type ChallengeProgress,
} from "@/lib/habits";
import { addDaysKey } from "@/lib/recurring";
import { cn, currencySymbol, fmt, formatCurrency, toDateKey } from "@/lib/utils";
import { tr, trn } from "@/lib/i18n";

const KIND_TEXT: Record<ChallengeKind, { label: string; hint: string }> = {
  no_spend: { label: "No-spend days", hint: "Days with no spending at all" },
  spend_under: { label: "Spend under", hint: "Keep spending under an amount" },
  skip_category: { label: "Skip a category", hint: "Nothing spent on one category" },
  save: { label: "Save an amount", hint: "Savings entries add up to it" },
  log_daily: { label: "Log every day", hint: "An entry or a mood each day" },
};
const LENGTHS = [3, 7, 14, 21, 30];

const field =
  "min-h-[44px] rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";
const select = "min-h-[44px] cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink/80 outline-hidden focus:border-amber/50";

const message = (err: unknown) =>
  typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : tr("Something went wrong — try again.");

export default function ChallengesPage() {
  const { transactions, moods, challenges, recurringReady, removeChallenge, createChallenge, reminders, loading } = useAppData();
  const today = toDateKey(new Date());
  const days = useMemo(() => loggedDays(transactions, moods), [transactions, moods]);
  const streak = useMemo(() => streakOf(days, today), [days, today]);
  const pattern = useMemo(() => moodSpendPattern(transactions, moods, today), [transactions, moods, today]);
  const [error, setError] = useState("");

  const rows = challenges.map((c) => ({ c, p: challengeProgress(c, transactions, moods, today) }));
  const going = rows.filter((r) => r.p.status === "active" || r.p.status === "upcoming");
  const finished = rows.filter((r) => r.p.status === "won" || r.p.status === "lost");
  const wins = finished.filter((r) => r.p.status === "won").length;

  const again = (c: Challenge) =>
    createChallenge({ kind: c.kind, target: c.target, categoryId: c.categoryId, categoryName: c.categoryName, startOn: today, days: c.days }).catch((err) =>
      setError(message(err)),
    );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{tr("Streaks & challenges")}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Keep it")}{" "}<span className="serif-italic text-amber/90">{tr("going.")}</span>
        </h1>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-label={tr("Streak")}>
          <div className="flex items-center gap-4">
            <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", streak.current ? "bg-amber/15 text-amber" : "bg-ink/[0.05] text-ink/35")}>
              <Flame className="h-7 w-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="font-display text-3xl font-semibold text-ink">{trn(streak.current, "{n}-day streak", "{n}-day streak")}</div>
              <div className="text-sm text-ink/50">
                {streak.current === 0
                  ? tr("Log an entry or a mood today to start one.")
                  : streak.todayDone
                    ? tr("Today's logged — see you tomorrow.")
                    : tr("Log something today to keep it.")}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-1" aria-label={tr("The last 28 days")}>
            {Array.from({ length: 28 }, (_, i) => addDaysKey(today, i - 27)).map((d) => (
              <span
                key={d}
                title={fmt(parseISO(d), "EEE, MMM d")}
                className={cn("h-6 flex-1 rounded-[4px]", days.has(d) ? "bg-amber/70" : "bg-ink/[0.06]", d === today && "ring-1 ring-amber/60")}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-ink/40">
            <span>{tr("Best: {n} days", { n: streak.best })}</span>
            <span>{tr("{n} challenges won", { n: wins })}</span>
          </div>
        </section>

        <section className="card p-5" aria-label={tr("Mood & money")}>
          <h2 className="font-display text-xl font-semibold text-ink">
            {tr("Mood")} <span className="serif-italic text-amber/90">{tr("& money")}</span>
          </h2>
          {pattern ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line p-3">
                  <div className="label text-[10px]">{tr("A low day")}</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-expense">{formatCurrency(pattern.low)}</div>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <div className="label text-[10px]">{tr("A good day")}</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-income">{formatCurrency(pattern.good)}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink/50">
                {pattern.low > pattern.good * 1.2
                  ? tr("You spend more on low days. The mood-spend alert tells you when a low day gets expensive.")
                  : tr("Your mood doesn't seem to drive your spending — nice.")}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink/50">{tr("Log your mood for a few more days to see how it and your spending go together.")}</p>
          )}
          <p className="mt-3 font-mono text-[11px] text-ink/40">
            {reminders.moodSpend ? tr("Mood-spend alerts are on.") : tr("Mood-spend alerts are off.")}{" "}
            <Link href="/app/settings/notifications" className="text-amber hover:underline">
              {tr("Notifications")}
            </Link>
          </p>
        </section>
      </div>

      {!recurringReady && !loading ? (
        <div className="card mb-6 px-5 py-6 text-sm text-ink/55">{tr("Challenges need the database update — run db/supabase.sql in Supabase.")}</div>
      ) : (
        <NewChallenge onError={setError} />
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
          {error}
        </p>
      )}

      {recurringReady && !loading && challenges.length === 0 && (
        <div className="card px-6 py-12 text-center text-sm text-ink/40">{tr("No challenges yet. A week of no-spend days is a good start.")}</div>
      )}

      {going.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {going.map(({ c, p }) => (
            <ChallengeCard key={c.id} c={c} p={p} onDelete={() => removeChallenge(c.id).catch((err) => setError(message(err)))} />
          ))}
        </div>
      )}
      {finished.length > 0 && (
        <>
          <div className="label mb-2">{tr("Finished")}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {finished.map(({ c, p }) => (
              <ChallengeCard key={c.id} c={c} p={p} onAgain={() => void again(c)} onDelete={() => removeChallenge(c.id).catch((err) => setError(message(err)))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function progressText(c: Challenge, p: ChallengeProgress): string {
  switch (c.kind) {
    case "no_spend":
      return tr("{n} of {goal} no-spend days", { n: p.value, goal: p.goal });
    case "spend_under":
      return tr("{spent} of {goal} spent", { spent: formatCurrency(p.value), goal: formatCurrency(p.goal) });
    case "skip_category":
      return p.value === 0 ? tr("None so far") : trn(p.value, "Slipped once", "Slipped {n} times");
    case "save":
      return tr("{saved} of {goal} saved", { saved: formatCurrency(p.value), goal: formatCurrency(p.goal) });
    case "log_daily":
      return tr("{n} of {goal} days logged", { n: p.value, goal: p.goal });
  }
}

function ChallengeCard({ c, p, onAgain, onDelete }: { c: Challenge; p: ChallengeProgress; onAgain?: () => void; onDelete: () => void }) {
  const title = challengeTitle(c, tr, formatCurrency);
  const color =
    p.status === "won"
      ? "rgb(var(--c-income))"
      : p.status === "lost"
        ? "rgb(var(--c-expense))"
        : c.kind === "spend_under" && p.ratio > 0.8
          ? "rgb(var(--mood-2))"
          : "rgb(var(--c-saving))";
  const when =
    p.status === "upcoming"
      ? tr("Starts {date}", { date: fmt(parseISO(c.startOn), "MMM d") })
      : p.status === "won"
        ? tr("Done 🎉")
        : p.status === "lost"
          ? tr("Missed")
          : p.daysLeft === 1
            ? tr("Last day")
            : tr("{n} days left", { n: p.daysLeft });
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold leading-snug text-ink">{title}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-ink/40">
            {fmt(parseISO(c.startOn), "MMM d")} – {fmt(parseISO(p.endOn), "MMM d")}
          </p>
        </div>
        {p.status === "won" ? <Trophy className="h-5 w-5 shrink-0 text-income" aria-hidden /> : null}
        <button onClick={onDelete} aria-label={tr("Delete challenge")} className="cursor-pointer text-ink/30 transition-colors hover:text-expense">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink/[0.06]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(p.ratio * 100)}%`, backgroundColor: color }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[12px]">
        <span className="text-ink/70">{progressText(c, p)}</span>
        <span className={cn(p.status === "won" ? "text-income" : p.status === "lost" ? "text-expense" : "text-ink/45")}>{when}</span>
      </div>
      {onAgain && (
        <button onClick={onAgain} className="mt-3 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink/70 hover:bg-ink/[0.04]">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {tr("Try again")}
        </button>
      )}
    </div>
  );
}

function NewChallenge({ onError }: { onError: (m: string) => void }) {
  const { categories, createChallenge } = useAppData();
  const today = toDateKey(new Date());
  const [kind, setKind] = useState<ChallengeKind>("no_spend");
  const [days, setDays] = useState(7);
  const [target, setTarget] = useState("4");
  const [categoryId, setCategoryId] = useState("");
  const [startOn, setStartOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const expense = categories.filter((c) => c.kind === "expense" && c.name !== "Break saving");
  const amountKind = kind === "spend_under" || kind === "save";
  const n = parseFloat(target);
  const valid =
    days >= 1 &&
    /^\d{4}-\d{2}-\d{2}$/.test(startOn) &&
    (kind === "log_daily" || (kind === "skip_category" ? !!categoryId : kind === "no_spend" ? n >= 1 && n <= days : n > 0));

  const start = async () => {
    if (!valid || busy) return;
    setBusy(true);
    onError("");
    try {
      const cat = expense.find((c) => c.id === categoryId);
      await createChallenge({
        kind,
        target: kind === "log_daily" || kind === "skip_category" ? 0 : kind === "no_spend" ? Math.round(n) : Math.round(n * 100) / 100,
        categoryId: kind === "skip_category" ? (cat?.id ?? null) : null,
        categoryName: kind === "skip_category" ? (cat?.name ?? "") : "",
        startOn,
        days,
      });
    } catch (err) {
      onError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb-6 space-y-3 p-4" role="group" aria-label={tr("Start a challenge")}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("Challenge")}>
        {CHALLENGE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            title={tr(KIND_TEXT[k].hint)}
            onClick={() => {
              setKind(k);
              setTarget(k === "no_spend" ? String(Math.max(1, Math.round(days / 2))) : "");
            }}
            className={cn(
              "min-h-[40px] cursor-pointer rounded-xl border px-3 text-sm transition-colors",
              kind === k ? "border-amber/50 bg-amber/10 font-semibold text-ink" : "border-line text-ink/60 hover:text-ink",
            )}
          >
            {tr(KIND_TEXT[k].label)}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink/45">
        {tr(KIND_TEXT[kind].hint)}
        {kind !== "save" && kind !== "log_daily" ? ` · ${tr("Automatic entries (rent, subscriptions) don't count.")}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {kind === "no_spend" && (
          <label className="flex items-center gap-2 text-sm text-ink/55">
            <input
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
              aria-label={tr("No-spend days")}
              className={cn(field, "w-16 text-center font-mono")}
            />
            {tr("no-spend days in")}
          </label>
        )}
        {amountKind && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
            <span className="font-mono text-ink/40">{currencySymbol()}</span>
            <input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={tr("Amount")}
              aria-label={tr("Amount")}
              className="min-h-[44px] w-24 bg-transparent font-mono text-sm text-ink outline-hidden"
            />
          </div>
        )}
        {kind === "skip_category" && (
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label={tr("Category")} className={select}>
            <option value="" className="bg-card">
              {tr("Pick a category")}
            </option>
            {expense.map((c) => (
              <option key={c.id} value={c.id} className="bg-card">
                {tr(c.name)}
              </option>
            ))}
          </select>
        )}
        <select
          value={days}
          onChange={(e) => {
            const d = Number(e.target.value);
            setDays(d);
            if (kind === "no_spend" && parseFloat(target) > d) setTarget(String(d));
          }}
          aria-label={tr("How long")}
          className={select}
        >
          {LENGTHS.map((d) => (
            <option key={d} value={d} className="bg-card">
              {trn(d, "{n} day", "{n} days")}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink/55">
          {tr("Starts")}
          <input type="date" value={startOn} min={today} onChange={(e) => setStartOn(e.target.value)} aria-label={tr("Starts")} className={cn(field, "text-ink/80")} />
        </label>
        <button
          type="button"
          onClick={() => void start()}
          disabled={!valid || busy}
          className="entry-btn ml-auto inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> {tr("Start")}
        </button>
      </div>
      {kind === "no_spend" && n > days && <p className="text-xs text-expense">{tr("At most {n} in {n} days.", { n: days })}</p>}
    </div>
  );
}
