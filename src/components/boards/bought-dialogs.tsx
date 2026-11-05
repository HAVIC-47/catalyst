"use client";

// What a to-buy list asks once things are bought: moving an item back off Bought
// asks about its expense before anything changes, and the expenses logged without a
// price are listed here to fill in — reached from the notice, the reminders bar and
// the ledger. Above the ticket editor, which may be waiting on the first one.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { parseISO } from "date-fns";
import { LoaderCircle, X } from "lucide-react";
import { useAppData, type UnbuyAsk } from "@/hooks/use-app-data";
import { needsPrice } from "@/lib/money";
import { cn, currencySymbol, fmt, formatCurrency } from "@/lib/utils";
import { asciiDigits, tr } from "@/lib/i18n";

export function BoughtDialogs() {
  const { unbuyAsk, pricesOpen } = useAppData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {unbuyAsk ? <UnbuyDialog key={unbuyAsk.ticket.id} ask={unbuyAsk} /> : pricesOpen ? <PriceDialog key="prices" /> : null}
    </AnimatePresence>,
    document.body,
  );
}

function Frame({ label, onDismiss, children, role = "dialog" }: { label: string; onDismiss: () => void; children: React.ReactNode; role?: "dialog" | "alertdialog" }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  return (
    <motion.div
      className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14 }}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={onDismiss} aria-hidden />
      <motion.div
        role={role}
        aria-modal="true"
        aria-label={label}
        initial={{ opacity: 0, y: -8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.99 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="card relative w-full max-w-md overflow-hidden"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** "Remove it from your expenses too?" — Cancel leaves the item where it was. */
function UnbuyDialog({ ask }: { ask: UnbuyAsk }) {
  const { expense, ticket, columnName, answer } = ask;
  const name = expense.note || ticket.title;
  const date = fmt(parseISO(expense.occurredOn), "MMM d");
  const button = "min-h-[44px] cursor-pointer rounded-xl px-4 text-sm font-semibold transition-colors";
  return (
    <Frame label={tr("Remove it from your expenses too?")} onDismiss={() => answer("cancel")} role="alertdialog">
      <div className="p-5 sm:p-6">
        <h2 className="font-display text-2xl font-semibold text-ink">{tr("Remove it from your expenses too?")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          {expense.amount > 0
            ? tr("{name} is in your expenses for {date} — {amount}.", { name, date, amount: formatCurrency(expense.amount) })
            : tr("{name} is in your expenses for {date}, with no price yet.", { name, date })}{" "}
          {tr("It's going back to {column}.", { column: columnName })}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-4">
        <button type="button" onClick={() => answer("cancel")} className={cn(button, "font-normal text-ink/60 hover:bg-ink/[0.04] hover:text-ink")}>
          {tr("Cancel")}
        </button>
        <button type="button" onClick={() => answer("keep")} className={cn(button, "border border-line text-ink/75 hover:bg-ink/[0.04]")}>
          {tr("Keep expense")}
        </button>
        <button autoFocus type="button" onClick={() => answer("remove")} className={cn(button, "bg-expense text-paper hover:brightness-110")}>
          {tr("Remove expense")}
        </button>
      </div>
    </Frame>
  );
}

/** Every expense still missing a price, in one go — the end of a shopping trip. */
function PriceDialog() {
  const { transactions, setPrices, closePrices } = useAppData();
  const items = useMemo(() => transactions.filter(needsPrice), [transactions]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // All priced (or deleted) already: nothing to ask.
  useEffect(() => {
    if (!items.length) closePrices();
  }, [items.length, closePrices]);

  const filled = items.flatMap((t) => {
    const n = Number(values[t.id] ?? "");
    return n > 0 && n < 1e10 ? [{ id: t.id, amount: Math.round(n * 100) / 100 }] : [];
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!filled.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await setPrices(filled);
      closePrices();
    } catch (err) {
      console.warn("[catalyst] could not save the prices", err);
      setError(tr("Couldn't save — check your connection."));
      setBusy(false);
    }
  };

  return (
    <Frame label={tr("Add prices")} onDismiss={closePrices}>
      <form onSubmit={(e) => void save(e)}>
        <div className="flex items-start justify-between gap-3 border-b border-line p-5 pb-4">
          <div className="min-w-0">
            <div className="label">{tr("Add prices")}</div>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{tr("What did you pay?")}</h2>
          </div>
          <button type="button" onClick={closePrices} aria-label={tr("Close")} className="cursor-pointer rounded-lg p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
          {items.map((t, i) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink/85">{t.note || tr(t.categoryName)}</span>
                <span className="block text-[11px] text-ink/45">
                  {fmt(parseISO(t.occurredOn), "MMM d")} · {tr(t.categoryName)}
                </span>
              </span>
              <span className="flex w-32 shrink-0 items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
                <span className="font-mono text-ink/40">{currencySymbol()}</span>
                <input
                  autoFocus={i === 0}
                  inputMode="decimal"
                  value={values[t.id] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [t.id]: asciiDigits(e.target.value).replace(/[^0-9.]/g, "") }))}
                  placeholder="0"
                  aria-label={tr("Price of {name}", { name: t.note || tr(t.categoryName) })}
                  className="min-h-[40px] w-full min-w-0 bg-transparent font-mono text-sm text-ink outline-hidden placeholder:text-ink/30"
                />
              </span>
            </li>
          ))}
        </ul>
        {error && (
          <p className="px-5 pt-3 text-xs text-expense" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <button type="button" onClick={closePrices} className="min-h-[44px] cursor-pointer rounded-xl px-4 text-sm text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink">
            {tr("Later")}
          </button>
          <button
            type="submit"
            disabled={!filled.length || busy}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {tr("Save")}
          </button>
        </div>
      </form>
    </Frame>
  );
}
