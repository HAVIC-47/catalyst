// The digest each AI summary is written from: one topic's rows for one period,
// read as the signed-in user (RLS-scoped) and boiled down to what matters —
// totals, the change since the period before, top categories, best and hardest
// days. Amounts arrive pre-formatted (৳1,25,000) and every comparison is already
// worked out, so the model only writes; it never does arithmetic.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pearson } from "@/lib/math";
import { BREAK_SAVING, MOOD_PRESETS, moodPreset } from "@/types";
import type { Insight, InsightPeriod, InsightTopic } from "@/lib/insights";

// ------------------------------------------------------------------ dates
// yyyy-mm-dd keys, handled in UTC so the server's own timezone never shifts a day.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayOf = (k: string) => new Date(`${k}T00:00:00Z`);
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (k: string, n: number) => {
  const d = dayOf(k);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
};
const daysBetween = (a: string, b: string) => Math.round((dayOf(b).getTime() - dayOf(a).getTime()) / 86_400_000);
const shortDate = (k: string) => `${MONTHS[dayOf(k).getUTCMonth()].slice(0, 3)} ${dayOf(k).getUTCDate()}`;
const longDate = (k: string) => `${shortDate(k)}, ${dayOf(k).getUTCFullYear()}`;
/** "Mon, Oct 12" */
const dateLabel = (k: string) => `${WEEKDAYS[dayOf(k).getUTCDay()].slice(0, 3)}, ${shortDate(k)}`;

export interface InsightWindow {
  period: InsightPeriod;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  label: string;
  prevLabel: string;
}

/** The period starting at `start` — a Sunday, the 1st or Jan 1 — or null if it isn't one. */
export function insightWindow(period: InsightPeriod, start: string): InsightWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const d = dayOf(start);
  if (Number.isNaN(d.getTime()) || keyOf(d) !== start) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (y < 2000 || y > 2200) return null;
  if (period === "week") {
    if (d.getUTCDay() !== 0) return null; // weeks start on Sunday in both apps
    const end = addDays(start, 6);
    const prevStart = addDays(start, -7);
    const prevEnd = addDays(start, -1);
    return {
      period,
      start,
      end,
      prevStart,
      prevEnd,
      label: `the week of ${shortDate(start)} – ${longDate(end)}`,
      prevLabel: `the week before (${shortDate(prevStart)} – ${shortDate(prevEnd)})`,
    };
  }
  if (period === "month") {
    if (d.getUTCDate() !== 1) return null;
    const prev = new Date(Date.UTC(y, m - 1, 1));
    return {
      period,
      start,
      end: keyOf(new Date(Date.UTC(y, m + 1, 0))),
      prevStart: keyOf(prev),
      prevEnd: addDays(start, -1),
      label: `${MONTHS[m]} ${y}`,
      prevLabel: `${MONTHS[prev.getUTCMonth()]} ${prev.getUTCFullYear()}`,
    };
  }
  if (m !== 0 || d.getUTCDate() !== 1) return null;
  return { period, start, end: `${y}-12-31`, prevStart: `${y - 1}-01-01`, prevEnd: `${y - 1}-12-31`, label: `${y}`, prevLabel: `${y - 1}` };
}

/** How much of the period has happened by `today`. */
function progress(w: InsightWindow, today: string) {
  const total = daysBetween(w.start, w.end) + 1;
  if (today > w.end) return { text: "complete", covered: total };
  if (today < w.start) return { text: "not started yet", covered: 0 };
  const covered = daysBetween(w.start, today) + 1;
  return { text: `in progress — day ${covered} of ${total}`, covered };
}

// ------------------------------------------------------------------ figures
const num = (v: number | string | null | undefined) => (typeof v === "string" ? parseFloat(v) : (v ?? 0)) || 0;
const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
/** Taka with en-IN grouping, like the apps: ৳1,25,000 / −৳950. */
const tk = (n: number) => `${n < 0 ? "−" : ""}৳${grouped.format(Math.abs(Math.round(n * 100) / 100))}`;
/** Whole taka, for worked-out figures (averages, per-month amounts). */
const tk0 = (n: number) => tk(Math.round(n));
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const clip = (s: string | null | undefined, max: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…` : t;
};
const moodText = (avg: number) => `${avg.toFixed(1)}/5 (${moodPreset(avg).label})`;

/** "up 12% (+৳2,300)" — the change from the previous period, already worked out. */
function change(now: number, before: number): string {
  if (before === 0) return now === 0 ? "none either time" : "none in the previous period";
  const diff = now - before;
  if (Math.abs(diff) < 0.005) return "no change";
  return `${diff > 0 ? "up" : "down"} ${Math.round((Math.abs(diff) / before) * 100)}% (${diff > 0 ? "+" : "−"}${tk(Math.abs(diff))})`;
}

/** Rows grouped by key with sum and count, biggest sum first. */
function groupSum<T>(rows: T[], key: (r: T) => string, value: (r: T) => number) {
  const m = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = key(r);
    const e = m.get(k) ?? { sum: 0, n: 0 };
    e.sum += value(r);
    e.n++;
    m.set(k, e);
  }
  return [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.sum - a.sum);
}

// ------------------------------------------------------------------ rows
interface TxRow {
  id: string;
  kind: "expense" | "income" | "saving";
  amount: number | string;
  category_name: string;
  place: string;
  note: string;
  occurred_on: string;
}
interface MoodRow {
  id: string;
  mood: number;
  note: string;
  tags: string[] | null;
  logged_on: string;
}
interface JournalRow {
  id: string;
  entry_on: string;
  mood: number | null;
  title: string;
  body: string;
}
interface GoalRow {
  id: string;
  title: string;
  target_amount: number | string;
  saved_amount: number | string;
  due_on: string | null;
}
interface BillRow {
  id: string;
  name: string;
  amount: number | string;
  due_on: string;
  recurrence: string;
  is_paid: boolean;
}
interface BudgetRow {
  id: string;
  category_name: string;
  amount: number | string;
}
interface ActivityRow {
  id: string;
  name: string;
}
interface ActivityLogRow {
  id: string;
  activity_id: string;
  logged_on: string;
}

/** Every row of a query, 1000 at a time (the API's page size). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let i = 0; i < 25; i++) {
    const { data, error } = await page(i * size, (i + 1) * size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

const TX = "id,kind,amount,category_name,place,note,occurred_on";
const txBetween = (db: SupabaseClient, from: string, to: string) =>
  all<TxRow>((a, b) =>
    db.from("transactions").select(TX).gte("occurred_on", from).lte("occurred_on", to).order("occurred_on").order("id").range(a, b),
  );
/** Money put into savings (kind "saving") and taken out ("Break saving" expenses). */
const savingFlowBetween = (db: SupabaseClient, from: string, to: string) =>
  all<TxRow>((a, b) =>
    db
      .from("transactions")
      .select(TX)
      .or(`kind.eq.saving,category_name.eq."${BREAK_SAVING}"`)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on")
      .order("id")
      .range(a, b),
  );
const moodsBetween = (db: SupabaseClient, from: string, to: string) =>
  all<MoodRow>((a, b) =>
    db.from("mood_logs").select("id,mood,note,tags,logged_on").gte("logged_on", from).lte("logged_on", to).order("logged_on").order("id").range(a, b),
  );
const journalBetween = (db: SupabaseClient, from: string, to: string) =>
  all<JournalRow>((a, b) =>
    db.from("journal_entries").select("id,entry_on,mood,title,body").gte("entry_on", from).lte("entry_on", to).order("entry_on").order("id").range(a, b),
  );
const activityLogsBetween = (db: SupabaseClient, from: string, to: string) =>
  all<ActivityLogRow>((a, b) =>
    db.from("activity_logs").select("id,activity_id,logged_on").gte("logged_on", from).lte("logged_on", to).order("id").range(a, b),
  );
const activitiesAll = (db: SupabaseClient) =>
  all<ActivityRow>((a, b) => db.from("activities").select("id,name").order("sort").order("id").range(a, b));
const goalsAll = (db: SupabaseClient) =>
  all<GoalRow>((a, b) => db.from("goals").select("id,title,target_amount,saved_amount,due_on").order("created_at").order("id").range(a, b));
const billsAll = (db: SupabaseClient) =>
  all<BillRow>((a, b) => db.from("bills").select("id,name,amount,due_on,recurrence,is_paid").order("due_on").order("id").range(a, b));
const budgetsAll = (db: SupabaseClient) =>
  all<BudgetRow>((a, b) => db.from("budgets").select("id,category_name,amount").order("id").range(a, b));

const txKey = (t: TxRow) => [t.id, t.kind, num(t.amount), t.category_name, t.occurred_on, t.note, t.place];

function flows(rows: TxRow[]) {
  let income = 0;
  let expense = 0;
  let saving = 0;
  let broken = 0;
  for (const t of rows) {
    const a = num(t.amount);
    if (t.kind === "income") income += a;
    else if (t.kind === "saving") saving += a;
    else {
      expense += a;
      if (t.category_name === BREAK_SAVING) broken += a;
    }
  }
  return { income, expense, saving, broken };
}

const entry = (t: TxRow) => ({
  date: dateLabel(t.occurred_on),
  amount: tk(num(t.amount)),
  ...(t.note ? { note: clip(t.note, 80) } : {}),
});

interface Digest {
  facts: Record<string, unknown>;
  source: unknown; // the rows it was built from, fingerprinted to spot newer data
  empty: boolean;
}

// ------------------------------------------------------------------ ledger
async function ledger(db: SupabaseClient, w: InsightWindow, today: string): Promise<Digest> {
  const [rows, budgets] = await Promise.all([txBetween(db, w.prevStart, w.end), w.period === "month" ? budgetsAll(db) : []]);
  const cur = rows.filter((t) => t.occurred_on >= w.start);
  const prev = rows.filter((t) => t.occurred_on <= w.prevEnd);
  const p = progress(w, today);
  const now = flows(cur);
  const before = flows(prev);
  const spends = cur.filter((t) => t.kind === "expense");
  const byCat = groupSum(spends, (t) => t.category_name || "Other", (t) => num(t.amount));
  const prevByCat = new Map(
    groupSum(prev.filter((t) => t.kind === "expense"), (t) => t.category_name || "Other", (t) => num(t.amount)).map((c) => [c.key, c.sum]),
  );
  const catNow = new Map(byCat.map((c) => [c.key, c.sum]));
  const movers = [...new Set([...catNow.keys(), ...prevByCat.keys()])]
    .map((k) => ({ category: k, now: catNow.get(k) ?? 0, before: prevByCat.get(k) ?? 0 }))
    .filter((x) => Math.abs(x.now - x.before) >= 1)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
    .slice(0, 3);

  // When in the period the money went.
  let shape: Record<string, unknown> = {};
  if (w.period === "week") {
    const last = today < w.end ? today : w.end;
    const days = Array.from({ length: Math.max(0, daysBetween(w.start, last) + 1) }, (_, i) => addDays(w.start, i));
    shape = {
      spendingByDay: days.map((k) => ({
        day: dateLabel(k),
        spent: tk(spends.filter((t) => t.occurred_on === k).reduce((s, t) => s + num(t.amount), 0)),
      })),
    };
  } else if (w.period === "month") {
    shape = {
      spendingByWeekday: groupSum(spends, (t) => WEEKDAYS[dayOf(t.occurred_on).getUTCDay()], (t) => num(t.amount)).map((g) => ({
        weekday: g.key,
        spent: tk(g.sum),
        share: pct(g.sum, now.expense),
      })),
    };
  } else {
    const months = MONTHS.map((name, i) => {
      const inMonth = cur.filter((t) => dayOf(t.occurred_on).getUTCMonth() === i);
      const f = flows(inMonth);
      return inMonth.length ? { month: name.slice(0, 3), earned: tk(f.income), spent: tk(f.expense) } : null;
    }).filter(Boolean);
    shape = { byMonth: months };
  }

  const places = groupSum(spends.filter((t) => t.place.trim()), (t) => t.place.trim(), (t) => num(t.amount)).slice(0, 5);
  const budgetFacts = budgets.map((b) => {
    const limit = num(b.amount);
    const spent = catNow.get(b.category_name) ?? 0;
    return {
      category: b.category_name,
      monthlyLimit: tk(limit),
      spent: tk(spent),
      used: pct(spent, limit),
      status: spent > limit ? `over by ${tk(spent - limit)}` : `${tk(limit - spent)} left`,
    };
  });

  return {
    empty: cur.length === 0,
    source: [rows.map(txKey), budgets.map((b) => [b.id, b.category_name, num(b.amount)])],
    facts: {
      period: w.label,
      status: p.text,
      totals: {
        earned: tk(now.income),
        spent: tk(now.expense),
        movedToSavings: tk(now.saving),
        net: tk(now.income - now.expense),
        transactions: cur.length,
        ...(p.covered ? { averageSpendPerDay: tk0(now.expense / p.covered) } : {}),
      },
      comparedWith: {
        period: w.prevLabel,
        earned: tk(before.income),
        spent: tk(before.expense),
        spendingChange: change(now.expense, before.expense),
        earningChange: change(now.income, before.income),
      },
      spendingByCategory: byCat.slice(0, 8).map((c) => ({
        category: c.key,
        spent: tk(c.sum),
        share: pct(c.sum, now.expense),
        entries: c.n,
      })),
      incomeBySource: groupSum(cur.filter((t) => t.kind === "income"), (t) => t.category_name || "Other", (t) => num(t.amount))
        .slice(0, 5)
        .map((c) => ({ source: c.key, earned: tk(c.sum) })),
      biggestCategoryChanges: movers.map((m) => ({ category: m.category, now: tk(m.now), before: tk(m.before) })),
      largestExpenses: [...spends]
        .sort((a, b) => num(b.amount) - num(a.amount))
        .slice(0, 5)
        .map((t) => ({ ...entry(t), category: t.category_name, ...(t.place ? { place: clip(t.place, 60) } : {}) })),
      ...shape,
      ...(places.length ? { topPlaces: places.map((g) => ({ place: g.key, spent: tk(g.sum), visits: g.n })) } : {}),
      ...(budgetFacts.length ? { budgets: budgetFacts } : {}),
    },
  };
}

// ------------------------------------------------------------------ goals helpers
function goalFact(g: GoalRow, today: string, monthlyPace?: number) {
  const target = num(g.target_amount);
  const saved = num(g.saved_amount);
  const f: Record<string, unknown> = {
    goal: g.title,
    target: tk(target),
    saved: tk(saved),
    progress: pct(Math.min(saved, target), target),
  };
  if (saved >= target) return { ...f, status: "reached" };
  const left = target - saved;
  f.stillNeeded = tk(left);
  if (!g.due_on) return { ...f, due: "no due date" };
  f.due = longDate(g.due_on);
  const days = daysBetween(today, g.due_on);
  if (days < 0) return { ...f, status: `past due by ${-days} days` };
  const months = Math.max(days / 30.44, 0.25);
  const need = left / months;
  f.timeLeft = days < 45 ? `${days} days` : `${(days / 30.44).toFixed(1)} months`;
  f.neededPerMonth = tk0(Math.ceil(need));
  if (monthlyPace !== undefined) f.status = monthlyPace >= need ? "on pace" : "behind pace";
  return f;
}

// ------------------------------------------------------------------ savings
async function savings(db: SupabaseClient, w: InsightWindow, today: string): Promise<Digest> {
  const [rows, pool, goals] = await Promise.all([
    txBetween(db, w.prevStart, w.end),
    savingFlowBetween(db, "1900-01-01", "9999-12-31"),
    goalsAll(db),
  ]);
  const cur = rows.filter((t) => t.occurred_on >= w.start);
  const prev = rows.filter((t) => t.occurred_on <= w.prevEnd);
  const now = flows(cur);
  const before = flows(prev);
  const all = flows(pool);
  const kept = (f: ReturnType<typeof flows>) => (f.income > 0 ? pct(f.income - f.expense, f.income) : "no income logged");
  const spends = cur.filter((t) => t.kind === "expense" && t.category_name !== BREAK_SAVING);

  return {
    empty: cur.length === 0,
    source: [rows.map(txKey), pool.map(txKey), goals],
    facts: {
      period: w.label,
      status: progress(w, today).text,
      thisPeriod: {
        putIntoSavings: tk(now.saving),
        takenOutOfSavings: tk(now.broken),
        netSaved: tk(now.saving - now.broken),
        earned: tk(now.income),
        spent: tk(now.expense),
        leftOverFromIncome: tk(now.income - now.expense),
        shareOfIncomeKept: kept(now),
      },
      comparedWith: {
        period: w.prevLabel,
        putIntoSavings: tk(before.saving),
        takenOutOfSavings: tk(before.broken),
        netSavedChange: change(now.saving - now.broken, before.saving - before.broken),
        shareOfIncomeKept: kept(before),
      },
      savingsPoolAllTime: tk(all.saving - all.broken),
      deposits: cur
        .filter((t) => t.kind === "saving")
        .sort((a, b) => num(b.amount) - num(a.amount))
        .slice(0, 6)
        .map(entry),
      withdrawals: cur
        .filter((t) => t.kind === "expense" && t.category_name === BREAK_SAVING)
        .sort((a, b) => num(b.amount) - num(a.amount))
        .slice(0, 5)
        .map(entry),
      biggestSpendingCategories: groupSum(spends, (t) => t.category_name || "Other", (t) => num(t.amount))
        .slice(0, 5)
        .map((c) => ({ category: c.key, spent: tk(c.sum), share: pct(c.sum, now.expense) })),
      goals: goals.slice(0, 8).map((g) => goalFact(g, today)),
    },
  };
}

// ------------------------------------------------------------------ goals
async function goals(db: SupabaseClient, w: InsightWindow, today: string): Promise<Digest> {
  // Pace = average net saving over the last three full months.
  const t = dayOf(today);
  const paceFrom = keyOf(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 3, 1)));
  const paceTo = keyOf(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)));
  const from = paceFrom < w.start ? paceFrom : w.start;
  const to = paceTo > w.end ? paceTo : w.end;
  const [goalRows, flowRows] = await Promise.all([goalsAll(db), savingFlowBetween(db, from, to)]);
  const paceFlow = flows(flowRows.filter((r) => r.occurred_on >= paceFrom && r.occurred_on <= paceTo));
  const pace = (paceFlow.saving - paceFlow.broken) / 3;
  const now = flows(flowRows.filter((r) => r.occurred_on >= w.start && r.occurred_on <= w.end));
  const target = goalRows.reduce((s, g) => s + num(g.target_amount), 0);
  const saved = goalRows.reduce((s, g) => s + Math.min(num(g.saved_amount), num(g.target_amount)), 0);
  const dueNow = goalRows.filter((g) => g.due_on && g.due_on >= w.start && g.due_on <= w.end);

  return {
    empty: goalRows.length === 0,
    source: [goalRows, flowRows.map(txKey)],
    facts: {
      period: w.label,
      status: progress(w, today).text,
      today: longDate(today),
      overview: {
        goals: goalRows.length,
        reached: goalRows.filter((g) => num(g.saved_amount) >= num(g.target_amount)).length,
        totalTarget: tk(target),
        totalSaved: tk(saved),
        overallProgress: pct(saved, target),
      },
      goals: goalRows.slice(0, 12).map((g) => goalFact(g, today, pace)),
      savingThisPeriod: { putIn: tk(now.saving), takenOut: tk(now.broken), net: tk(now.saving - now.broken) },
      averageMonthlyNetSaving: `${tk0(pace)} (last three full months)`,
      ...(dueNow.length ? { goalsDueThisPeriod: dueNow.map((g) => g.title) } : {}),
    },
  };
}

// ------------------------------------------------------------------ bills
const BILL_CATEGORIES = new Set(["rent", "utilities", "internet", "subscriptions"]);

async function bills(db: SupabaseClient, w: InsightWindow, today: string): Promise<Digest> {
  const [billRows, rows] = await Promise.all([billsAll(db), txBetween(db, w.start, w.end)]);
  const status = (b: BillRow) => {
    if (b.is_paid) return "paid";
    const d = daysBetween(today, b.due_on);
    return d < 0 ? `overdue by ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "due today" : `due in ${d} day${d === 1 ? "" : "s"}`;
  };
  const perMonth = (b: BillRow) => {
    const a = num(b.amount);
    return b.recurrence === "weekly" ? (a * 52) / 12 : b.recurrence === "monthly" ? a : b.recurrence === "yearly" ? a / 12 : 0;
  };
  const inPeriod = billRows.filter((b) => b.due_on >= w.start && b.due_on <= w.end);
  const sum = (bs: BillRow[]) => bs.reduce((s, b) => s + num(b.amount), 0);
  const unpaid = billRows.filter((b) => !b.is_paid);
  const soon = addDays(today, 14);
  const recurring = billRows.filter((b) => perMonth(b) > 0).sort((a, b) => perMonth(b) - perMonth(a));
  const billSpend = groupSum(
    rows.filter((t) => t.kind === "expense" && BILL_CATEGORIES.has(t.category_name.toLowerCase())),
    (t) => t.category_name,
    (t) => num(t.amount),
  );

  return {
    empty: billRows.length === 0,
    source: [billRows, rows.map(txKey)],
    facts: {
      period: w.label,
      status: progress(w, today).text,
      today: longDate(today),
      dueThisPeriod: inPeriod.map((b) => ({
        bill: b.name,
        amount: tk(num(b.amount)),
        due: dateLabel(b.due_on),
        repeats: b.recurrence,
        status: status(b),
      })),
      thisPeriodTotals: {
        due: tk(sum(inPeriod)),
        paid: tk(sum(inPeriod.filter((b) => b.is_paid))),
        unpaid: tk(sum(inPeriod.filter((b) => !b.is_paid))),
      },
      overdue: unpaid
        .filter((b) => b.due_on < today)
        .map((b) => ({ bill: b.name, amount: tk(num(b.amount)), due: longDate(b.due_on), status: status(b) })),
      comingUpInTwoWeeks: unpaid
        .filter((b) => b.due_on >= today && b.due_on <= soon)
        .map((b) => ({ bill: b.name, amount: tk(num(b.amount)), due: dateLabel(b.due_on), status: status(b) })),
      recurringBillsPerMonth: tk0(recurring.reduce((s, b) => s + perMonth(b), 0)),
      billsByRepeat: Object.fromEntries(
        ["weekly", "monthly", "yearly", "once"].map((r) => [r, billRows.filter((b) => b.recurrence === r).length]),
      ),
      biggestRecurringBills: recurring.slice(0, 5).map((b) => ({ bill: b.name, perMonth: tk0(perMonth(b)), repeats: b.recurrence })),
      ...(billSpend.length ? { spendingInBillCategories: billSpend.map((c) => ({ category: c.key, spent: tk(c.sum) })) } : {}),
    },
  };
}

// ------------------------------------------------------------------ journal
async function journal(db: SupabaseClient, w: InsightWindow, today: string): Promise<Digest> {
  const [entries, prevCount, activities, logs] = await Promise.all([
    journalBetween(db, w.start, w.end),
    db
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .gte("entry_on", w.prevStart)
      .lte("entry_on", w.prevEnd)
      .then(({ count, error }) => {
        if (error) throw error;
        return count ?? 0;
      }),
    activitiesAll(db),
    activityLogsBetween(db, w.start, w.end),
  ]);
  const p = progress(w, today);

  // Keep the digest a sensible size: evenly spaced entries when there are many,
  // each trimmed, within an overall character budget.
  const MAX_ENTRIES = 60;
  const picked =
    entries.length > MAX_ENTRIES
      ? Array.from({ length: MAX_ENTRIES }, (_, i) => entries[Math.floor((i * entries.length) / MAX_ENTRIES)])
      : entries;
  const perEntry = w.period === "year" ? 280 : w.period === "month" ? 500 : 900;
  let budget = 14_000;
  const list = picked.map((e) => {
    const text = clip(e.body, Math.min(perEntry, Math.max(0, budget)));
    budget -= text.length;
    return {
      date: dateLabel(e.entry_on),
      ...(e.mood ? { mood: moodPreset(e.mood).label } : {}),
      ...(e.title ? { title: clip(e.title, 100) } : {}),
      ...(text ? { text } : {}),
    };
  });
  const moods = entries.filter((e) => e.mood).map((e) => e.mood as number);
  const covered = p.covered || daysBetween(w.start, w.end) + 1;
  const habits = activities
    .map((a) => {
      const n = new Set(logs.filter((l) => l.activity_id === a.id).map((l) => l.logged_on)).size;
      return { habit: a.name, daysDone: n, rate: pct(n, covered) };
    })
    .filter((h) => h.daysDone > 0);

  return {
    empty: entries.length === 0 && logs.length === 0,
    source: [entries, logs, activities],
    facts: {
      period: w.label,
      status: p.text,
      entriesWritten: entries.length,
      entriesInPreviousPeriod: prevCount,
      ...(moods.length ? { averageEntryMood: moodText(mean(moods)) } : {}),
      ...(entries.length > picked.length ? { note: `showing ${picked.length} of ${entries.length} entries, spread over the period` } : {}),
      entries: list,
      ...(habits.length ? { habitsKept: habits, daysSoFar: covered } : {}),
    },
  };
}

// ------------------------------------------------------------------ mood
async function mood(db: SupabaseClient, w: InsightWindow, today: string): Promise<Digest> {
  const [logs, rows, entries, activities, actLogs] = await Promise.all([
    moodsBetween(db, w.prevStart, w.end),
    txBetween(db, w.start, w.end),
    journalBetween(db, w.start, w.end),
    activitiesAll(db),
    activityLogsBetween(db, w.start, w.end),
  ]);
  const cur = logs.filter((l) => l.logged_on >= w.start);
  const prev = logs.filter((l) => l.logged_on <= w.prevEnd);

  // Per-day averages: several moods can be logged in one day.
  const days = new Map<string, { sum: number; n: number; tags: Set<string> }>();
  for (const l of cur) {
    const d = days.get(l.logged_on) ?? { sum: 0, n: 0, tags: new Set<string>() };
    d.sum += l.mood;
    d.n++;
    for (const t of l.tags ?? []) d.tags.add(t);
    days.set(l.logged_on, d);
  }
  const daily = [...days.entries()].map(([day, d]) => ({ day, avg: d.sum / d.n, tags: [...d.tags] }));
  const dayFact = (d: (typeof daily)[number]) => ({
    date: dateLabel(d.day),
    mood: moodText(d.avg),
    ...(d.tags.length ? { about: d.tags.slice(0, 5) } : {}),
  });

  let shape: Record<string, unknown> = {};
  if (w.period === "week") {
    shape = { byDay: daily.map(dayFact) };
  } else {
    const ranked = [...daily].sort((a, b) => b.avg - a.avg);
    const n = Math.min(3, Math.floor(ranked.length / 2)); // best and hardest never overlap
    const byWeekday = WEEKDAYS.map((name, i) => {
      const ds = daily.filter((d) => dayOf(d.day).getUTCDay() === i);
      return ds.length ? { weekday: name, average: mean(ds.map((d) => d.avg)).toFixed(1), days: ds.length } : null;
    }).filter(Boolean);
    shape = {
      byWeekday,
      ...(n ? { bestDays: ranked.slice(0, n).map(dayFact), hardestDays: ranked.slice(-n).reverse().map(dayFact) } : {}),
    };
    if (w.period === "year") {
      shape.byMonth = MONTHS.map((name, i) => {
        const ds = cur.filter((l) => dayOf(l.logged_on).getUTCMonth() === i);
        return ds.length ? { month: name.slice(0, 3), average: mean(ds.map((l) => l.mood)).toFixed(1), logs: ds.length } : null;
      }).filter(Boolean);
    }
  }

  // What each context tag went with.
  const tagStats = new Map<string, { n: number; sum: number }>();
  for (const l of cur)
    for (const t of l.tags ?? []) {
      const s = tagStats.get(t) ?? { n: 0, sum: 0 };
      s.n++;
      s.sum += l.mood;
      tagStats.set(t, s);
    }
  const tags = [...tagStats.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 10)
    .map(([tag, s]) => ({ tag, times: s.n, averageMood: (s.sum / s.n).toFixed(1) }));

  // Mood against the day's spending.
  const spendByDay = new Map<string, number>();
  for (const t of rows) if (t.kind === "expense") spendByDay.set(t.occurred_on, (spendByDay.get(t.occurred_on) ?? 0) + num(t.amount));
  const paired = daily.map((d) => ({ mood: d.avg, spend: spendByDay.get(d.day) ?? 0 }));
  let money: Record<string, unknown> | undefined;
  if (paired.length >= 4) {
    const spends = paired.map((x) => x.spend).sort((a, b) => a - b);
    const median = spends[Math.floor(spends.length / 2)];
    const high = paired.filter((x) => x.spend > median);
    const low = paired.filter((x) => x.spend <= median);
    const r = pearson(paired.map((x) => x.spend), paired.map((x) => x.mood));
    const a = Math.abs(r);
    money = {
      daysCompared: paired.length,
      ...(high.length ? { averageMoodOnHigherSpendDays: mean(high.map((x) => x.mood)).toFixed(1) } : {}),
      ...(low.length ? { averageMoodOnLowerSpendDays: mean(low.map((x) => x.mood)).toFixed(1) } : {}),
      link:
        a < 0.12
          ? "no clear link between spending and mood"
          : `${a >= 0.6 ? "strong" : a >= 0.3 ? "moderate" : "mild"}: more spending went with ${r < 0 ? "lower" : "higher"} mood`,
    };
  }

  // Mood on days a habit was done vs the other logged days.
  const doneOn = new Map<string, Set<string>>();
  for (const l of actLogs) (doneOn.get(l.activity_id) ?? doneOn.set(l.activity_id, new Set()).get(l.activity_id)!).add(l.logged_on);
  const habits = activities
    .map((a) => {
      const done = doneOn.get(a.id) ?? new Set<string>();
      const on = daily.filter((d) => done.has(d.day));
      const off = daily.filter((d) => !done.has(d.day));
      return on.length >= 2 && off.length >= 2
        ? {
            habit: a.name,
            moodOnDaysDone: mean(on.map((d) => d.avg)).toFixed(1),
            moodOnOtherDays: mean(off.map((d) => d.avg)).toFixed(1),
            daysDone: done.size,
          }
        : null;
    })
    .filter(Boolean);

  const counts = Object.fromEntries(
    [...MOOD_PRESETS].reverse().map((m) => [m.label, cur.filter((l) => l.mood === m.value).length] as const).filter(([, n]) => n > 0),
  );
  const notes = cur
    .filter((l) => l.note.trim())
    .slice(-20)
    .map((l) => ({ date: dateLabel(l.logged_on), mood: moodPreset(l.mood).label, note: clip(l.note, 200) }));
  const entryMoods = entries.filter((e) => e.mood).map((e) => e.mood as number);

  return {
    empty: cur.length === 0,
    source: [logs, rows.map(txKey), entries.map((e) => [e.id, e.entry_on, e.mood]), actLogs, activities],
    facts: {
      period: w.label,
      status: progress(w, today).text,
      moodLogs: cur.length,
      daysLogged: days.size,
      averageMood: moodText(mean(cur.map((l) => l.mood))),
      comparedWith: {
        period: w.prevLabel,
        averageMood: prev.length ? moodText(mean(prev.map((l) => l.mood))) : "no moods logged",
      },
      moodCounts: counts,
      ...shape,
      ...(tags.length ? { contextTags: tags } : {}),
      ...(notes.length ? { notes } : {}),
      ...(money ? { moneyAndMood: money } : {}),
      ...(habits.length ? { habits } : {}),
      ...(entryMoods.length ? { journalMood: `${moodText(mean(entryMoods))} across ${entryMoods.length} journal entries` } : {}),
    },
  };
}

// ------------------------------------------------------------------ entry point
const BUILDERS: Record<InsightTopic, (db: SupabaseClient, w: InsightWindow, today: string) => Promise<Digest>> = {
  ledger,
  savings,
  goals,
  bills,
  journal,
  mood,
};

export async function buildDigest(db: SupabaseClient, topic: InsightTopic, w: InsightWindow, today: string) {
  const d = await BUILDERS[topic](db, w, today);
  return {
    facts: d.facts,
    empty: d.empty,
    hash: createHash("sha256").update(JSON.stringify(d.source)).digest("hex").slice(0, 32),
  };
}

// ------------------------------------------------------------------ prompt
const BASE = `You write short insight cards for Catalyst, a personal mood and money tracker used mostly in Bangladesh. You get a JSON digest of one person's data for one period. Write to them as "you": warm, plain and specific, like a sharp friend — never preachy, never a lecture.

Rules:
- Use only what the digest says. Never invent amounts, dates, events, people or reasons.
- Amounts are Bangladeshi Taka. Copy them exactly as the digest writes them (e.g. ৳1,25,000). Don't convert, recalculate or use $.
- Lead with what matters most, using the digest's own comparisons and figures.
- If the period is still in progress, say "so far". If there is little data, say so in a sentence and keep everything short.
- Write in English, even when entries or notes are in Bengali.
- headline: at most 8 words, no full stop — like a newspaper headline.
- summary: 2 to 4 sentences, at most 70 words.
- highlights: 2 to 4 short facts from the digest, each under 20 words.
- suggestions: 2 to 4 specific, doable next steps that follow from the data. title: at most 6 words. detail: 1 or 2 sentences.
- Plain text only: no markdown, no emoji, no bullet characters.`;

const FOCUS: Record<InsightTopic, string> = {
  ledger:
    "Topic: the ledger — money in and out. Say where the money went and came from, what changed since the previous period, and how budgets are holding up if they're given. Suggestions are about managing money: limits for categories that are growing, cutting repeat costs, planning big spends, keeping spending below income.",
  savings:
    'Topic: savings — money put into savings, money taken back out ("Break saving"), the share of income kept, and the all-time savings pool. Suggestions are realistic ways to save more: a set amount moved on payday, trimming the biggest spending categories, avoiding withdrawals.',
  goals:
    "Topic: savings goals — progress on each goal and whether the saving pace is enough to reach them by their due dates. Suggestions are ways to reach the goals sooner or more surely, using the monthly amounts the digest gives.",
  bills:
    "Topic: bills — what is due, paid and overdue, and the monthly bill load. Suggestions help avoid late payments (reminders, paying on a set day) and lower recurring costs.",
  journal:
    "Topic: the journal — what the entries were about, recurring themes, how the days felt and which habits were kept. Summarise themes; don't quote long passages or private details. Suggestions are small, kind habits for wellbeing that build on what the entries show helps.",
  mood:
    "Topic: mood — how it moved and what went with better or worse days (context tags, habits, spending, weekdays). Suggestions are gentle, concrete ways to feel better, based on what the data shows helps. If most logs are Low or Awful, include one suggestion to talk to someone they trust or a professional, calmly and without alarm.",
};

export const systemPrompt = (topic: InsightTopic) => `${BASE}\n\n${FOCUS[topic]}`;
export const userPrompt = (facts: Record<string, unknown>) => `Digest:\n${JSON.stringify(facts)}`;

export const INSIGHT_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    summary: { type: "STRING" },
    highlights: { type: "ARRAY", items: { type: "STRING" } },
    suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, detail: { type: "STRING" } },
        required: ["title", "detail"],
      },
    },
  },
  required: ["headline", "summary", "highlights", "suggestions"],
};

/** Never trust model output (or a stored row): keep only well-formed, bounded text. */
export function cleanInsight(raw: unknown): Insight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) =>
    typeof v === "string" ? v.replace(/[*_`#]+/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const summary = text(r.summary, 900);
  if (!summary) return null;
  return {
    headline: text(r.headline, 90).replace(/[.。]+$/, "") || "Your summary",
    summary,
    highlights: list(r.highlights)
      .map((h) => text(h, 240))
      .filter(Boolean)
      .slice(0, 4),
    suggestions: list(r.suggestions)
      .map((s) => {
        const o = (s ?? {}) as Record<string, unknown>;
        return { title: text(o.title, 80), detail: text(o.detail, 320) };
      })
      .filter((s) => s.title || s.detail)
      .slice(0, 4),
  };
}
