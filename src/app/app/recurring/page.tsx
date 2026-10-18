"use client";

// Recurring income and expenses: a salary on the 1st, rent, subscriptions. Each
// one is added to the ledger by itself on its day and time — by this page or the
// Android app when open, or by the hourly reminders job when neither is. The
// dates come from lib/recurring.ts (the app and the job use the same rules).
import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Pause, Pencil, Play, Plus, Repeat, Trash2, X } from "lucide-react";
import { useAppData, type RecurringInput } from "@/hooks/use-app-data";
import type { RecurringFrequency, RecurringRule } from "@/types";
import { dueDates, firstNextOn, hasEnded, occurrenceOnOrAfter, sameSchedule, zonedNow } from "@/lib/recurring";
import { defaultWallet, ruleCategory } from "@/lib/money";
import { LIMITS } from "@/lib/limits";
import { cn, currencySymbol, fmt, formatCurrency, toDateKey } from "@/lib/utils";
import { tr, trn } from "@/lib/i18n";

type Repeat = "week" | "2weeks" | "twice" | "month" | "3months" | "year";
const REPEATS: { value: Repeat; label: string; frequency: RecurringFrequency; every: number }[] = [
  { value: "week", label: "Every week", frequency: "weekly", every: 1 },
  { value: "2weeks", label: "Every 2 weeks", frequency: "weekly", every: 2 },
  { value: "twice", label: "Twice a month", frequency: "twice_monthly", every: 1 },
  { value: "month", label: "Every month", frequency: "monthly", every: 1 },
  { value: "3months", label: "Every 3 months", frequency: "monthly", every: 3 },
  { value: "year", label: "Every year", frequency: "monthly", every: 12 },
];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function repeatOf(r: Pick<RecurringRule, "frequency" | "every">): Repeat {
  if (r.frequency === "weekly") return r.every >= 2 ? "2weeks" : "week";
  if (r.frequency === "twice_monthly") return "twice";
  return r.every >= 12 ? "year" : r.every >= 3 ? "3months" : "month";
}

const timeText = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return fmt(new Date(2000, 0, 1, h || 0, m || 0), "h:mm a");
};

/** "Every month on day 1 · 9:00 AM" and the like. */
function scheduleText(r: Pick<RecurringRule, "frequency" | "every" | "day1" | "day2" | "time" | "startOn">): string {
  const when = (() => {
    switch (repeatOf(r)) {
      case "week":
        return tr("Every {weekday}", { weekday: tr(WEEKDAYS[r.day1 - 1] ?? "Monday") });
      case "2weeks":
        return tr("Every other {weekday}", { weekday: tr(WEEKDAYS[r.day1 - 1] ?? "Monday") });
      case "twice":
        return tr("Twice a month, on days {a} and {b}", { a: Math.min(r.day1, r.day2 ?? r.day1), b: Math.max(r.day1, r.day2 ?? r.day1) });
      case "month":
        return tr("Every month on day {day}", { day: r.day1 });
      case "3months":
        return tr("Every 3 months on day {day}", { day: r.day1 });
      case "year":
        return tr("Every year on {date}", { date: fmt(parseISO(r.startOn), "MMM d") });
    }
  })();
  return `${when} · ${timeText(r.time)}`;
}

const field =
  "min-h-[44px] rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";
const select = "min-h-[44px] cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink/80 outline-hidden focus:border-amber/50";

const message = (err: unknown) =>
  typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : tr("Something went wrong — try again.");

export default function RecurringPage() {
  const { recurring, recurringReady, removeRecurring, pauseRecurring, loading } = useAppData();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const live = recurring.filter((r) => !r.paused && !hasEnded(r));
  // A rough month: whole units are enough for "about".
  const monthly = (kind: "income" | "expense") =>
    Math.round(
      live
        .filter((r) => r.kind === kind)
        .reduce((s, r) => s + r.amount * (r.frequency === "weekly" ? 52 / 12 / r.every : r.frequency === "twice_monthly" ? 2 : 1 / r.every), 0),
    );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{tr("Recurring · {n} on", { n: live.length })}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Money on")}{" "}<span className="serif-italic text-amber/90">{tr("repeat.")}</span>
        </h1>
        {live.length > 0 && (
          <p className="mt-3 font-mono text-sm text-ink/45">
            {tr("About {income} in and {expense} out a month", { income: formatCurrency(monthly("income")), expense: formatCurrency(monthly("expense")) })}
          </p>
        )}
        <p className="mt-2 max-w-xl text-sm text-ink/45">
          {tr("Salary, rent, subscriptions: set one up once and it's added to your ledger by itself on its day and time — even while the app is closed. You get a notification each time it's added.")}
        </p>
      </div>

      {!recurringReady && !loading ? (
        <div className="card mb-6 px-5 py-6 text-sm text-ink/55">
          {tr("Recurring entries need the database update — run db/supabase.sql in Supabase.")}
        </div>
      ) : (
        <div className="card mb-6 p-4">
          <RecurringForm key="new" />
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
          {error}
        </p>
      )}

      {recurringReady && !loading && recurring.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-ink/40">{tr("Nothing recurring yet. Add your salary or rent above.")}</div>
      )}

      {recurring.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {recurring.map((r) =>
            editing === r.id ? (
              <div key={r.id} className="bg-ink/[0.02] p-4">
                <RecurringForm rule={r} onDone={() => setEditing(null)} />
              </div>
            ) : (
              <RuleRow
                key={r.id}
                rule={r}
                onEdit={() => setEditing(r.id)}
                onPause={() => pauseRecurring(r.id, !r.paused).catch((err) => setError(message(err)))}
                onDelete={() => {
                  if (window.confirm(tr('Delete "{name}"? Entries it already added stay in the ledger.', { name: r.name }))) {
                    removeRecurring(r.id).catch((err) => setError(message(err)));
                  }
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function RuleRow({ rule: r, onEdit, onPause, onDelete }: { rule: RecurringRule; onEdit: () => void; onPause: () => void; onDelete: () => void }) {
  const { categories, wallets, walletsReady } = useAppData();
  const ended = hasEnded(r);
  const cat = ruleCategory(r, categories);
  const wallet = walletsReady ? (wallets.find((w) => w.id === r.walletId) ?? defaultWallet(wallets)) : null;
  const income = r.kind === "income";
  const Icon = income ? ArrowDownLeft : ArrowUpRight;
  const next = occurrenceOnOrAfter(r, r.nextOn) ?? r.nextOn;
  // Name, amount and the buttons on top; the schedule gets the whole width below
  // (on a phone a narrow column would wrap it word by word).
  return (
    <div className={cn("p-4", (r.paused || ended) && "opacity-60")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", income ? "bg-income/10 text-income" : "bg-expense/10 text-expense")}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink/85">{r.name}</span>
        <span className={cn("whitespace-nowrap font-mono text-sm tabular", income ? "text-income" : "text-ink/80")}>
          {formatCurrency(income ? r.amount : -r.amount, { sign: true })}
        </span>
        <RowButtons r={r} ended={ended} onEdit={onEdit} onPause={onPause} onDelete={onDelete} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 pl-11 font-mono text-[11px] text-ink/40">
        <span>{scheduleText(r)}</span>
        <span>·</span>
        <span className={cn(!r.paused && !ended && "text-amber/90")}>
          {r.paused ? tr("paused") : ended ? tr("ended") : tr("next {date}", { date: fmt(parseISO(next), "EEE, MMM d") })}
        </span>
        {cat && <span>· {tr(cat.name)}</span>}
        {wallet && <span>· {tr(wallet.name)}</span>}
      </div>
    </div>
  );
}

function RowButtons({ r, ended, onEdit, onPause, onDelete }: { r: RecurringRule; ended: boolean; onEdit: () => void; onPause: () => void; onDelete: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {!ended && (
        <button
          onClick={onPause}
          aria-label={r.paused ? tr("Resume {name}", { name: r.name }) : tr("Pause {name}", { name: r.name })}
          title={r.paused ? tr("Resume") : tr("Pause")}
          className="cursor-pointer rounded-lg p-1 text-ink/35 transition-colors hover:bg-ink/5 hover:text-amber"
        >
          {r.paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
        </button>
      )}
      <button onClick={onEdit} aria-label={tr("Edit {name}", { name: r.name })} className="cursor-pointer rounded-lg p-1 text-ink/35 transition-colors hover:bg-ink/5 hover:text-amber">
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button onClick={onDelete} aria-label={tr("Delete {name}", { name: r.name })} className="cursor-pointer rounded-lg p-1 text-ink/30 transition-colors hover:text-expense">
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </span>
  );
}

/** Add a recurring entry, or change one (`rule`). */
function RecurringForm({ rule, onDone }: { rule?: RecurringRule; onDone?: () => void }) {
  const { categories, wallets, walletsReady, createRecurring, editRecurring } = useAppData();
  const today = toDateKey(new Date());
  const [kind, setKind] = useState<"expense" | "income">(rule?.kind ?? "income");
  const [name, setName] = useState(rule?.name ?? "");
  const [amount, setAmount] = useState(rule ? String(rule.amount) : "");
  const [repeat, setRepeat] = useState<Repeat>(rule ? repeatOf(rule) : "month");
  const [weekday, setWeekday] = useState(rule?.frequency === "weekly" ? rule.day1 : 5);
  const [day1, setDay1] = useState(rule && rule.frequency !== "weekly" ? rule.day1 : 1);
  const [day2, setDay2] = useState(rule?.day2 ?? 15);
  const [time, setTime] = useState(rule?.time ?? "09:00");
  const [startOn, setStartOn] = useState(rule?.startOn ?? today);
  const [endOn, setEndOn] = useState(rule?.endOn ?? "");
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [walletId, setWalletId] = useState(rule?.walletId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const r = REPEATS.find((x) => x.value === repeat)!;
  const fromStart = repeat === "3months" || repeat === "year"; // the first date sets the day
  const input: RecurringInput = {
    name: name.trim(),
    kind,
    amount: Math.round((parseFloat(amount) || 0) * 100) / 100,
    categoryId: categoryId || null,
    walletId: walletId || null,
    frequency: r.frequency,
    every: r.every,
    day1: r.frequency === "weekly" ? weekday : fromStart ? Number(startOn.slice(8, 10)) || 1 : day1,
    day2: r.frequency === "twice_monthly" ? day2 : null,
    time,
    startOn,
    endOn: endOn || null,
  };
  const problem = !input.name
    ? ""
    : !(input.amount > 0)
      ? ""
      : r.frequency === "twice_monthly" && day1 === day2
        ? tr("Pick two different days.")
        : input.endOn && input.endOn < startOn
          ? tr("It can't end before it starts.")
          : "";
  const valid = !!input.name && input.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(startOn) && !problem;

  // When the next one will be added (and how many are due already).
  const preview = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn)) return null;
    const tz = rule?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = zonedNow(tz);
    const nextOn =
      rule && sameSchedule(input, rule) ? rule.nextOn : firstNextOn(input, rule ? (now.day > startOn ? now.day : startOn) : startOn);
    if (input.endOn && nextOn > input.endOn) return { nextOn: null, due: 0 };
    const due = dueDates({ ...input, nextOn, paused: false }, now.day, now.time).length;
    return { nextOn: occurrenceOnOrAfter(input, nextOn) ?? nextOn, due };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat, weekday, day1, day2, time, startOn, endOn, rule]);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      if (rule) await editRecurring(rule.id, input);
      else await createRecurring(input);
      if (rule) onDone?.();
      else {
        setName("");
        setAmount("");
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  const kindCats = categories.filter((c) => c.kind === kind);
  const liveWallets = wallets.filter((w) => !w.archived || w.id === walletId);
  const autoCat = ruleCategory({ categoryId: null, name: name || "—", kind }, categories);

  return (
    <div className="space-y-3" role="group" aria-label={rule ? tr("Edit {name}", { name: rule.name }) : tr("New recurring entry")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line p-0.5" role="radiogroup" aria-label={tr("Type")}>
          {(["income", "expense"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setCategoryId("");
              }}
              className={cn(
                "min-h-[40px] cursor-pointer rounded-[10px] px-3 text-sm font-semibold transition-colors",
                kind === k ? (k === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense") : "text-ink/50 hover:text-ink",
              )}
            >
              {k === "income" ? tr("Income") : tr("Expense")}
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "income" ? tr("Name (e.g. Salary)") : tr("Name (e.g. Rent, Netflix)")}
          maxLength={LIMITS.name}
          aria-label={tr("Name")}
          className={cn(field, "min-w-[10rem] flex-1")}
        />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
          <span className="font-mono text-ink/40">{currencySymbol()}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={tr("Amount")}
            aria-label={tr("Amount")}
            className="min-h-[44px] w-24 bg-transparent font-mono text-sm text-ink outline-hidden"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} aria-label={tr("How often")} className={select}>
          {REPEATS.map((x) => (
            <option key={x.value} value={x.value} className="bg-card">
              {tr(x.label)}
            </option>
          ))}
        </select>
        {r.frequency === "weekly" && (
          <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} aria-label={tr("Day of the week")} className={select}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1} className="bg-card">
                {tr(d)}
              </option>
            ))}
          </select>
        )}
        {(repeat === "month" || repeat === "twice") && (
          <DaySelect value={day1} onChange={setDay1} label={repeat === "twice" ? tr("First day") : tr("Day of the month")} />
        )}
        {repeat === "twice" && <DaySelect value={day2} onChange={setDay2} label={tr("Second day")} />}
        <label className="flex items-center gap-2 text-sm text-ink/55">
          {tr("at")}
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label={tr("Time")} className={cn(field, "text-ink/80")} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ink/55">
          {fromStart ? tr("First date") : tr("Starts")}
          <input type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} aria-label={fromStart ? tr("First date") : tr("Starts")} className={cn(field, "text-ink/80")} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink/55">
          {tr("Ends")}
          <input type="date" value={endOn} min={startOn} onChange={(e) => setEndOn(e.target.value)} aria-label={tr("Ends (optional)")} className={cn(field, "text-ink/80")} />
        </label>
        {endOn && (
          <button type="button" onClick={() => setEndOn("")} className="cursor-pointer text-xs text-ink/45 hover:text-amber">
            {tr("No end")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label={tr("Category")} className={select}>
          <option value="" className="bg-card">
            {tr("Category: {name} (auto)", { name: tr(autoCat?.name ?? "Other") })}
          </option>
          {kindCats.map((c) => (
            <option key={c.id} value={c.id} className="bg-card">
              {tr(c.name)}
            </option>
          ))}
        </select>
        {walletsReady && liveWallets.length > 0 && (
          <select value={walletId} onChange={(e) => setWalletId(e.target.value)} aria-label={tr("Wallet")} className={select}>
            <option value="" className="bg-card">
              {kind === "income" ? tr("Into: {name}", { name: tr(defaultWallet(wallets)?.name ?? "Cash") }) : tr("From: {name}", { name: tr(defaultWallet(wallets)?.name ?? "Cash") })}
            </option>
            {liveWallets.map((w) => (
              <option key={w.id} value={w.id} className="bg-card">
                {kind === "income" ? tr("Into: {name}", { name: tr(w.name) }) : tr("From: {name}", { name: tr(w.name) })}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          {rule && (
            <button
              type="button"
              onClick={onDone}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />{" "}{tr("Cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!valid || saving}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
          >
            {rule ? tr("Save") : <><Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />{" "}{tr("Add")}</>}
          </button>
        </div>
      </div>

      {preview && valid && (
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-ink/45">
          <Repeat className="h-3 w-3" aria-hidden />
          {preview.nextOn === null
            ? tr("No dates left before it ends.")
            : preview.due > 0
              ? trn(preview.due, "1 date is due already — it's added as soon as you save.", "{n} dates are due already — they're added as soon as you save.")
              : tr("Next: {date} at {time}", { date: fmt(parseISO(preview.nextOn), "EEE, MMM d"), time: timeText(time) })}
        </p>
      )}
      {(problem || error) && (
        <p className="text-xs text-expense" role="alert">
          {problem || error}
        </p>
      )}
    </div>
  );
}

function DaySelect({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} title={label} className={select}>
      {DAYS.map((d) => (
        <option key={d} value={d} className="bg-card">
          {d >= 29 ? tr("Day {n} (or the last day)", { n: d }) : tr("Day {n}", { n: d })}
        </option>
      ))}
    </select>
  );
}
