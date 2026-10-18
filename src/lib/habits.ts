// Streaks, challenges and mood-spend alerts, worked out from the entries
// themselves — a challenge stores only its settings. Shared with the Android app
// (lib/util/habits.dart). Type-only imports, so a plain Node script can test it.
import type { MoodLog, Transaction } from "@/types";
import { addDaysKey, daysBetween } from "./recurring";

type Tx = Pick<Transaction, "kind" | "amount" | "occurredOn" | "categoryId" | "categoryName"> & { recurringId?: string | null };
type Mood = Pick<MoodLog, "mood" | "loggedOn">;

const BREAK_SAVING = "Break saving";
const cents = (n: number) => Math.round(n * 100) / 100;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Money spent by hand: an expense that isn't automatic (recurring) or savings broken. */
export const isSpend = (t: Tx): boolean => t.kind === "expense" && !t.recurringId && t.categoryName !== BREAK_SAVING;

// ---------------------------------------------------------------- streaks
/** Days with something logged by hand: a money entry (not an automatic one) or a mood. */
export function loggedDays(transactions: Tx[], moods: Mood[]): Set<string> {
  const days = new Set<string>();
  for (const t of transactions) if (!t.recurringId) days.add(t.occurredOn);
  for (const m of moods) days.add(m.loggedOn);
  return days;
}

export interface Streak {
  current: number; // days in a row up to today (or up to yesterday, while today is still open)
  best: number; // the longest run ever
  todayDone: boolean; // today already counts
  since: string | null; // the current run's first day
}

export function streakOf(days: Set<string>, today: string): Streak {
  const todayDone = days.has(today);
  let current = 0;
  let since: string | null = null;
  for (let d = todayDone ? today : addDaysKey(today, -1); days.has(d); d = addDaysKey(d, -1)) {
    current++;
    since = d;
  }
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of [...days].filter((k) => k <= today).sort()) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), todayDone, since };
}

/** Streak lengths worth a notification. */
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365];

/** The biggest milestone a streak of `n` days has reached (0 for none yet). */
export function streakMilestone(n: number): number {
  if (n >= 400) return Math.floor(n / 100) * 100;
  return STREAK_MILESTONES.filter((m) => m <= n).pop() ?? 0;
}

// ---------------------------------------------------------------- challenges
export type ChallengeKind = "no_spend" | "spend_under" | "skip_category" | "save" | "log_daily";

export const CHALLENGE_KINDS: ChallengeKind[] = ["no_spend", "spend_under", "skip_category", "save", "log_daily"];

export interface ChallengeSpec {
  kind: ChallengeKind;
  target: number; // no-spend days, or an amount to stay under / save
  categoryId: string | null; // skip_category
  categoryName: string;
  startOn: string;
  days: number;
}

/** What a challenge asks, in words — `t` translates (tr, or the reminders job's
 *  own), `money` formats an amount. */
export function challengeTitle(
  c: Pick<ChallengeSpec, "kind" | "target" | "categoryName" | "days">,
  t: (key: string, args?: Record<string, string | number>) => string,
  money: (n: number) => string,
): string {
  const days = Math.round(c.days);
  switch (c.kind) {
    case "no_spend":
      return t("{n} no-spend days in {days} days", { n: Math.round(c.target), days });
    case "spend_under":
      return t("Spend under {amount} in {days} days", { amount: money(c.target), days });
    case "skip_category":
      return t("No {category} for {days} days", { category: t(c.categoryName), days });
    case "save":
      return t("Save {amount} in {days} days", { amount: money(c.target), days });
    case "log_daily":
      return t("Log something every day for {days} days", { days });
  }
}

export type ChallengeStatus = "upcoming" | "active" | "won" | "lost";

export interface ChallengeProgress {
  status: ChallengeStatus;
  endOn: string; // its last day
  daysLeft: number; // including today
  value: number; // no-spend days, amount spent or saved, days logged, slips
  goal: number;
  ratio: number; // 0 … 1, for a progress bar
}

/** How a challenge stands today. Automatic entries (rent, subscriptions) never count as spending. */
export function challengeProgress(c: ChallengeSpec, transactions: Tx[], moods: Mood[], today: string): ChallengeProgress {
  const days = Math.max(1, Math.round(c.days));
  const endOn = addDaysKey(c.startOn, days - 1);
  const last = today < endOn ? today : endOn; // the window so far
  const yesterday = addDaysKey(today, -1);
  const complete = yesterday < endOn ? yesterday : endOn; // its days that are over
  const completeDays = complete < c.startOn ? 0 : daysBetween(c.startOn, complete) + 1;
  const daysLeft = today > endOn ? 0 : today < c.startOn ? days : daysBetween(today, endOn) + 1;
  const over = today > endOn;
  const inWindow = (k: string, to = last) => k >= c.startOn && k <= to;
  const spends = transactions.filter((t) => isSpend(t) && inWindow(t.occurredOn));
  const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

  let value = 0;
  let goal = 0;
  let won = false;
  let lost = false;
  let ratio = 0;
  switch (c.kind) {
    case "no_spend": {
      goal = Math.min(days, Math.max(1, Math.round(c.target)));
      const spendDays = new Set(spends.filter((t) => t.occurredOn <= complete).map((t) => t.occurredOn));
      value = completeDays - spendDays.size;
      won = value >= goal;
      lost = !won && completeDays - value > days - goal;
      ratio = value / goal;
      break;
    }
    case "spend_under": {
      goal = c.target;
      value = cents(spends.reduce((s, t) => s + t.amount, 0));
      lost = value > goal;
      won = !lost && over;
      ratio = goal > 0 ? value / goal : 1;
      break;
    }
    case "skip_category": {
      value = spends.filter((t) => (c.categoryId && t.categoryId === c.categoryId) || same(t.categoryName, c.categoryName)).length;
      lost = value > 0;
      won = !lost && over;
      ratio = (days - daysLeft) / days;
      break;
    }
    case "save": {
      goal = c.target;
      value = cents(transactions.filter((t) => t.kind === "saving" && inWindow(t.occurredOn)).reduce((s, t) => s + t.amount, 0));
      won = goal > 0 && value >= goal;
      lost = !won && over;
      ratio = goal > 0 ? value / goal : 0;
      break;
    }
    case "log_daily": {
      goal = days;
      const logged = loggedDays(transactions, moods);
      for (let d = c.startOn; d <= last; d = addDaysKey(d, 1)) if (logged.has(d)) value++;
      let missed = false;
      for (let d = c.startOn; d <= complete; d = addDaysKey(d, 1)) if (!logged.has(d)) missed = true;
      lost = missed;
      won = !lost && value >= days;
      ratio = value / days;
      break;
    }
  }
  const status: ChallengeStatus = today < c.startOn ? "upcoming" : won ? "won" : lost ? "lost" : "active";
  return { status, endOn, daysLeft, value, goal, ratio: clamp01(ratio) };
}

// ---------------------------------------------------------------- mood × money
export interface MoodSpend {
  spent: number; // spent by hand today
  usual: number; // a usual day's spending (the 30 days before)
  ratio: number; // spent ÷ usual, one decimal
  mood: number; // today's average mood
}

/** A low day (average mood 2.5 or under) with at least 1.5× the usual day's
 *  spending — once there's a week of history to know what usual is. */
export function moodSpendAlert(transactions: Tx[], moods: Mood[], today: string): MoodSpend | null {
  const todays = moods.filter((m) => m.loggedOn === today);
  if (!todays.length) return null;
  const mood = todays.reduce((s, m) => s + m.mood, 0) / todays.length;
  if (mood > 2.5) return null;
  const spent = cents(transactions.filter((t) => isSpend(t) && t.occurredOn === today).reduce((s, t) => s + t.amount, 0));
  if (spent <= 0) return null;
  const first = transactions.reduce((m, t) => (t.occurredOn < m ? t.occurredOn : m), today);
  const from = addDaysKey(today, -30) > first ? addDaysKey(today, -30) : first;
  const n = daysBetween(from, today);
  if (n < 7) return null;
  const before = transactions.filter((t) => isSpend(t) && t.occurredOn >= from && t.occurredOn < today).reduce((s, t) => s + t.amount, 0);
  const usual = before / n;
  if (usual <= 0 || spent < usual * 1.5) return null;
  return { spent, usual: cents(usual), ratio: Math.round((spent / usual) * 10) / 10, mood: Math.round(mood * 10) / 10 };
}

/** Over the last `span` days: a low day's average spending next to a good day's
 *  (null until there are at least 3 of each). */
export function moodSpendPattern(
  transactions: Tx[],
  moods: Mood[],
  today: string,
  span = 90,
): { low: number; good: number; lowDays: number; goodDays: number } | null {
  const from = addDaysKey(today, -(span - 1));
  const byDay = new Map<string, number[]>();
  for (const m of moods) if (m.loggedOn >= from && m.loggedOn <= today) (byDay.get(m.loggedOn) ?? byDay.set(m.loggedOn, []).get(m.loggedOn)!).push(m.mood);
  const spentOn = new Map<string, number>();
  for (const t of transactions) if (isSpend(t) && t.occurredOn >= from && t.occurredOn <= today) spentOn.set(t.occurredOn, (spentOn.get(t.occurredOn) ?? 0) + t.amount);
  let low = 0, good = 0, lowDays = 0, goodDays = 0;
  for (const [day, list] of byDay) {
    const avg = list.reduce((s, x) => s + x, 0) / list.length;
    if (avg <= 2.5) {
      lowDays++;
      low += spentOn.get(day) ?? 0;
    } else if (avg >= 3.5) {
      goodDays++;
      good += spentOn.get(day) ?? 0;
    }
  }
  if (lowDays < 3 || goodDays < 3) return null;
  return { low: cents(low / lowDays), good: cents(good / goodDays), lowDays, goodDays };
}
