"use client";

// Edit a transaction from the ledger (its pen button): type, amount, category,
// date, time, place and note — or delete it. Every total in the app (ledger,
// dashboard, calendar, budgets, savings) is computed from the transactions list,
// so they all follow the saved values straight away.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, MapPin, PiggyBank, Trash2, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { Category, Kind, NewTransaction, Transaction } from "@/types";
import { TAKA, cn, combineDateTime } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { CategoryTile, TimeField } from "@/components/entry/entry-modal";

export function TransactionEditor({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tx, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {tx && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Edit transaction"
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="card relative my-auto w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-start justify-between border-b border-line p-6 pb-5">
              <div>
                <div className="label">{format(parseISO(tx.occurredOn), "EEE · MMM d, yyyy")}</div>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ink">Edit transaction</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <EditForm key={tx.id} tx={tx} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const KINDS: { k: Kind; label: string; Icon: typeof ArrowUpRight; on: string }[] = [
  { k: "expense", label: "Expense", Icon: ArrowUpRight, on: "text-expense" },
  { k: "income", label: "Income", Icon: ArrowDownLeft, on: "text-income" },
  { k: "saving", label: "Saving", Icon: PiggyBank, on: "text-saving" },
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const message = (err: unknown, fallback: string) =>
  typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : fallback;

/** HH:mm of a timestamp, in local time. */
function localTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "12:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function EditForm({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { categories, editMoney, removeMoney } = useAppData();
  const [kind, setKind] = useState<Kind>(tx.kind);
  const [amount, setAmount] = useState(String(tx.amount));
  const [pick, setPick] = useState<string | null>(null); // category id chosen here; null = the entry's own
  const [date, setDate] = useState(tx.occurredOn);
  const [time, setTime] = useState(() => localTime(tx.occurredAt));
  const [place, setPlace] = useState(tx.place);
  const [note, setNote] = useState(tx.note);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = categories.filter((c) => c.kind === kind);
  const picked = kind !== "saving" && pick ? list.find((c) => c.id === pick) : undefined;
  // Its own category's tile: by id, or by name for older rows. One deleted since
  // shows as its saved name ("kept") until another is picked.
  const own = kind === tx.kind ? (list.find((c) => c.id === tx.categoryId) ?? list.find((c) => same(c.name, tx.categoryName))) : undefined;
  const kept = kind === tx.kind && kind !== "saving" && !own;
  // Another type: the same name there, else Other, else the first.
  const near = kind === tx.kind ? undefined : (list.find((c) => same(c.name, tx.categoryName)) ?? list.find((c) => same(c.name, "Other")) ?? list[0]);
  const activeId = picked?.id ?? own?.id ?? near?.id;
  // Left alone, the category stays exactly as saved.
  const cat: { id: string | null; name: string } | null = picked
    ? { id: picked.id, name: picked.name }
    : kind === tx.kind
      ? { id: tx.categoryId, name: tx.categoryName }
      : kind === "saving"
        ? { id: null, name: "Saving" }
        : near
          ? { id: near.id, name: near.name }
          : null;

  const value = parseFloat(amount);
  const touchedWhen = date !== tx.occurredOn || time !== localTime(tx.occurredAt);
  const next: NewTransaction | null =
    value > 0 && cat && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? {
          kind,
          amount: Math.round(value * 100) / 100,
          categoryId: cat.id,
          categoryName: cat.name,
          place: kind === "saving" ? "" : place.trim(),
          note: note.trim(),
          occurredOn: date,
          // Untouched, the original timestamp stays exactly as it was.
          occurredAt: touchedWhen ? combineDateTime(date, time) : tx.occurredAt,
        }
      : null;
  const changed =
    !!next &&
    (next.kind !== tx.kind ||
      next.amount !== tx.amount ||
      next.categoryId !== tx.categoryId ||
      next.categoryName !== tx.categoryName ||
      next.place !== tx.place ||
      next.note !== tx.note ||
      next.occurredOn !== tx.occurredOn ||
      next.occurredAt !== tx.occurredAt);

  const save = async () => {
    if (!next || !changed || busy) return;
    setBusy("save");
    setError(null);
    try {
      await editMoney(tx.id, next);
      onClose();
    } catch (err) {
      setError(message(err, "Couldn't save — check your connection."));
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy || !window.confirm("Delete this transaction? This can't be undone.")) return;
    setBusy("delete");
    setError(null);
    try {
      await removeMoney(tx.id);
      onClose();
    } catch (err) {
      setError(message(err, "Couldn't delete — check your connection."));
      setBusy(null);
    }
  };

  const keptTile: Category = { id: "", name: tx.categoryName, kind, color: "#7A746A", sort: -1 };
  const field =
    "min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";

  return (
    <>
      <div className="max-h-[62vh] space-y-6 overflow-y-auto p-6">
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-ink/[0.02] p-1">
          {KINDS.map(({ k, label, Icon, on }) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                setPick(null);
              }}
              className={cn(
                "flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-200",
                kind === k ? cn("bg-ink/[0.06]", on) : "text-ink/45 hover:text-ink/70",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

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
              className="w-full bg-transparent font-mono text-3xl font-semibold tabular text-ink outline-hidden"
            />
          </div>
        </div>

        {kind === "saving" ? (
          <p className="rounded-xl border border-line bg-ink/[0.02] px-3 py-2 text-xs text-ink/50">
            Savings go into your savings pool — they don&apos;t have a category.
          </p>
        ) : (
          <div>
            <div className="label mb-2">Category</div>
            {list.length === 0 && !kept ? (
              <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-ink/45">
                No {kind} categories yet — add them in Settings.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {kept && <CategoryTile cat={keptTile} active={!picked} onClick={() => setPick(null)} />}
                {list.map((c) => (
                  <CategoryTile key={c.id} cat={c} active={activeId === c.id} onClick={() => setPick(c.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="label mb-2">Date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className="min-h-[44px] rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink/80 outline-hidden focus:border-amber/50"
            />
          </div>
          <TimeField value={time} onChange={setTime} />
        </div>

        {kind !== "saving" && (
          <div>
            <div className="label mb-2">Place</div>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" aria-hidden />
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Star Kabab, Aarong, Pathao…"
                maxLength={LIMITS.place}
                aria-label="Place"
                className={cn(field, "pl-10")}
              />
            </div>
          </div>
        )}

        <div>
          <div className="label mb-2">Note · optional</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it for?"
            maxLength={LIMITS.note}
            aria-label="Note"
            className={field}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line p-4">
        <button
          type="button"
          onClick={() => void remove()}
          disabled={!!busy}
          className="hairline inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm text-ink/70 transition-colors hover:border-expense/40 hover:bg-expense/10 hover:text-expense disabled:opacity-40"
        >
          {busy === "delete" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          Delete
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!next || !changed || !!busy}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry transition-transform duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {busy === "save" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
          {busy === "save" ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}
