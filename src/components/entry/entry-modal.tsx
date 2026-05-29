"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { X, ArrowUpRight, ArrowDownLeft, MapPin } from "lucide-react";
import { useAppData, type EntryTab } from "@/hooks/use-app-data";
import { MOOD_PRESETS, MOOD_TAGS, type Category, type Kind } from "@/types";
import { TAKA, cn } from "@/lib/utils";

// Combine a yyyy-mm-dd date with an HH:mm time into a local ISO timestamp.
function combineDateTime(dateKey: string, time: string): string {
  return new Date(`${dateKey}T${time || "12:00"}:00`).toISOString();
}
function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="label mb-2">Time</div>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Time"
        className="min-h-[44px] rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink/80 outline-none focus:border-amber/50 [color-scheme:dark]"
      />
    </div>
  );
}

export function EntryModal() {
  const { entryOpen, entryTab, entryDate, closeEntry, setEntryTab } = useAppData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!entryOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeEntry();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entryOpen, closeEntry]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {entryOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={closeEntry} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="New entry"
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="card relative my-auto w-full max-w-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-line p-6 pb-5">
              <div>
                <div className="label">{format(parseISO(entryDate), "EEEE")}</div>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ink">
                  {format(parseISO(entryDate), "MMM d")}{" "}
                  <span className="text-ink/35">{format(parseISO(entryDate), "yyyy")}</span>
                </h2>
              </div>
              <button
                onClick={closeEntry}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-line px-6 pt-4">
              {(["money", "mood", "saving"] as EntryTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setEntryTab(t)}
                  className={cn(
                    "relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm font-medium capitalize transition-colors duration-200",
                    entryTab === t ? "text-ink" : "text-ink/40 hover:text-ink/70",
                  )}
                >
                  {t}
                  {entryTab === t && (
                    <motion.span
                      layoutId="entry-tab"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-amber"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6">
              {entryTab === "money" && <MoneyForm dateKey={entryDate} />}
              {entryTab === "mood" && <MoodForm dateKey={entryDate} />}
              {entryTab === "saving" && <SavingForm dateKey={entryDate} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------------------------------------------------------------- Money tab */

function MoneyForm({ dateKey }: { dateKey: string }) {
  const { categories, addMoney, closeEntry } = useAppData();
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState(nowTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = categories.filter((c) => c.kind === kind);
  const selected = list.find((c) => c.id === categoryId) ?? list[0];
  const value = parseFloat(amount);
  const valid = value > 0 && !!selected;

  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const submit = async (keepOpen = false) => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addMoney({
        kind,
        amount: Math.round(value * 100) / 100,
        categoryId: selected!.id,
        categoryName: selected!.name,
        place: place.trim(),
        note: note.trim(),
        occurredOn: dateKey,
        occurredAt: combineDateTime(dateKey, time),
      });
      if (keepOpen) {
        // Reset the money fields but keep the modal open so the next entry
        // (e.g. an income right after an expense) can be added immediately.
        setSavedFlash(`Saved ${kind} · ${TAKA}${amount}`);
        setAmount("");
        setCategoryId(null);
        setPlace("");
        setNote("");
        setTime(nowTime());
        setTimeout(() => setSavedFlash(null), 2200);
      } else {
        closeEntry();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.toLowerCase().includes("column") || msg.includes("PGRST")
          ? "Database missing a column — run the migration in db/supabase.sql, then retry."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* expense / income */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink/[0.02] p-1">
        {([
          { k: "expense" as Kind, label: "Expense", Icon: ArrowUpRight, color: "text-expense" },
          { k: "income" as Kind, label: "Income", Icon: ArrowDownLeft, color: "text-income" },
        ]).map(({ k, label, Icon, color }) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setCategoryId(null);
            }}
            className={cn(
              "flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-200",
              kind === k ? cn("bg-ink/[0.06]", color) : "text-ink/45 hover:text-ink/70",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* amount */}
      <div>
        <div className="label mb-2">Amount</div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-ink/[0.02] px-4 py-3 focus-within:border-amber/50">
          <span className="font-mono text-2xl text-ink/40">{TAKA}</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            aria-label="Amount"
            className="w-full bg-transparent font-mono text-3xl font-semibold tabular text-ink outline-none"
          />
        </div>
      </div>

      {/* category */}
      <div>
        <div className="label mb-2">Category</div>
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-ink/45">
            No {kind} categories yet.{" "}
            <a href="/settings" className="text-amber underline-offset-2 hover:underline">
              Add them in Settings →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {list.map((c) => (
              <CategoryTile
                key={c.id}
                cat={c}
                active={selected?.id === c.id}
                onClick={() => setCategoryId(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* time */}
      <TimeField value={time} onChange={setTime} />

      {/* place */}
      <div>
        <div className="label mb-2">Place</div>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Star Kabab, Aarong, Pathao…"
            aria-label="Place"
            className="min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] pl-10 pr-3 text-sm text-ink outline-none focus:border-amber/50"
          />
        </div>
      </div>

      {/* note */}
      <div>
        <div className="label mb-2">Note · optional</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was it for?"
          aria-label="Note"
          className="min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-none focus:border-amber/50"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense">
          {error}
        </p>
      )}
      {savedFlash && (
        <p className="rounded-xl border border-income/30 bg-income/10 px-3 py-2 text-xs text-income">
          {savedFlash} — add another below.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => submit(true)}
          disabled={!valid || saving}
          className="hairline min-h-[48px] flex-1 cursor-pointer rounded-xl text-sm font-semibold text-ink/80 transition-colors duration-200 hover:bg-ink/[0.05] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save &amp; add another
        </button>
        <button
          onClick={() => submit(false)}
          disabled={!valid || saving}
          className="entry-btn min-h-[48px] flex-1 cursor-pointer rounded-xl text-sm font-semibold text-paper shadow-entry transition-transform duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Save {kind} &amp; close
        </button>
      </div>
    </div>
  );
}

function CategoryTile({
  cat,
  active,
  onClick,
}: {
  cat: Category;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 transition-colors duration-200",
        active ? "border-ink/30 bg-ink/[0.06]" : "border-line hover:bg-ink/[0.03]",
      )}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
        style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
      >
        {cat.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="max-w-full truncate text-xs text-ink/70">{cat.name}</span>
    </button>
  );
}

/* ----------------------------------------------------------------- Mood tab */

function MoodForm({ dateKey }: { dateKey: string }) {
  const { saveMood, closeEntry, moodsForDate } = useAppData();
  const dayMoods = moodsForDate(dateKey);
  const [mood, setMood] = useState<number>(3);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [time, setTime] = useState(nowTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (t: string) =>
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveMood({
        mood,
        note: note.trim(),
        tags,
        loggedOn: dateKey,
        loggedAt: combineDateTime(dateKey, time),
      });
      closeEntry();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.toLowerCase().includes("column") || msg.includes("PGRST")
          ? "Database missing a column — run the migration in db/supabase.sql, then retry."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const active = MOOD_PRESETS.find((m) => m.value === mood)!;

  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-3">How was the day?</div>
        <div className="flex items-center justify-between gap-2">
          {MOOD_PRESETS.map((m) => {
            const on = mood === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setMood(m.value)}
                aria-label={m.label}
                aria-pressed={on}
                className={cn(
                  "flex h-20 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-200",
                  on ? "border-ink/30 bg-ink/[0.06]" : "border-line hover:bg-ink/[0.03]",
                )}
                style={on ? { boxShadow: `0 0 26px -8px ${m.color}` } : undefined}
              >
                <span className={cn("text-3xl transition-all", on ? "grayscale-0" : "grayscale opacity-55")}>
                  {m.emoji}
                </span>
                <span className="text-[10px] font-medium" style={{ color: on ? m.color : "rgba(255,255,255,0.4)" }}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="label mb-2">What was it about? · optional</div>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  on
                    ? "border-amber/50 bg-amber/15 text-amber"
                    : "border-line text-ink/55 hover:bg-ink/[0.04] hover:text-ink/80",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <TimeField value={time} onChange={setTime} />

      <div>
        <div className="label mb-2">Note · optional</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What shaped the mood right now?"
          aria-label="Mood note"
          className="w-full resize-none rounded-xl border border-line bg-ink/[0.02] p-3 text-sm text-ink outline-none focus:border-amber/50"
        />
      </div>

      {dayMoods.length > 0 && (
        <div>
          <div className="label mb-2">Already logged today · {dayMoods.length}</div>
          <div className="flex flex-wrap gap-2">
            {dayMoods.map((m) => {
              const pr = MOOD_PRESETS.find((x) => x.value === m.mood)!;
              return (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink/[0.02] px-2.5 py-1 text-xs text-ink/60"
                >
                  <span className="text-sm">{pr.emoji}</span>
                  {new Date(m.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-ink/35">
            Multiple moods per day are kept — the day shows their average.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={saving}
        className="min-h-[48px] w-full cursor-pointer rounded-xl border text-sm font-semibold transition-all duration-200 active:scale-[0.99] disabled:opacity-40"
        style={{
          borderColor: `${active.color}66`,
          backgroundColor: `${active.color}1f`,
          color: active.color,
        }}
      >
        Save mood
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- Saving tab */

function SavingForm({ dateKey }: { dateKey: string }) {
  const { addMoney, closeEntry, transactions } = useAppData();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState(nowTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const added = transactions
    .filter((t) => t.kind === "saving")
    .reduce((s, t) => s + t.amount, 0);
  const broken = transactions
    .filter((t) => t.kind === "expense" && t.categoryName === "Break saving")
    .reduce((s, t) => s + t.amount, 0);
  const total = added - broken;

  const value = parseFloat(amount);
  const valid = value > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addMoney({
        kind: "saving",
        amount: Math.round(value * 100) / 100,
        categoryId: null,
        categoryName: "Saving",
        place: "",
        note: note.trim(),
        occurredOn: dateKey,
        occurredAt: combineDateTime(dateKey, time),
      });
      closeEntry();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.toLowerCase().includes("constraint") ||
          msg.toLowerCase().includes("column") ||
          msg.includes("PGRST")
          ? "Database hasn't been migrated for savings yet — run the latest db/supabase.sql, then retry."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Total savings tile */}
      <div className="rounded-2xl border border-line bg-ink/[0.02] p-5 text-center">
        <div className="label">Total savings</div>
        <div className="mt-1 font-mono text-3xl font-semibold tabular text-[#3D80BC]">
          {TAKA}
          {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(total)}
        </div>
        <div className="mt-2 font-mono text-[11px] text-ink/40">
          {TAKA}
          {new Intl.NumberFormat("en-IN").format(added)} added · {TAKA}
          {new Intl.NumberFormat("en-IN").format(broken)} broken
        </div>
      </div>

      {/* Amount */}
      <div>
        <div className="label mb-2">Add to savings</div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-ink/[0.02] px-4 py-3 focus-within:border-[#3D80BC]/50">
          <span className="font-mono text-2xl text-ink/40">{TAKA}</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            aria-label="Saving amount"
            className="w-full bg-transparent font-mono text-3xl font-semibold tabular text-ink outline-none"
          />
        </div>
      </div>

      <TimeField value={time} onChange={setTime} />

      <div>
        <div className="label mb-2">Note · optional</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What is this saving for?"
          aria-label="Saving note"
          className="min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-none focus:border-[#3D80BC]/50"
        />
      </div>

      <p className="rounded-xl border border-line bg-ink/[0.02] px-3 py-2 text-[11px] text-ink/45">
        Tip: pick the <span className="text-[#3D80BC]">Break saving</span> category on the Money tab
        to pull from this pool.
      </p>

      {error && (
        <p className="rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!valid || saving}
        className="min-h-[48px] w-full cursor-pointer rounded-xl border border-[#3D80BC]/40 bg-[#3D80BC]/15 text-sm font-semibold text-[#3D80BC] transition-all duration-200 hover:bg-[#3D80BC]/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save saving
      </button>
    </div>
  );
}
