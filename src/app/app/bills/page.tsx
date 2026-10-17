"use client";

import { useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Plus, Trash2, Check, Bell, Pencil, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { Bill } from "@/types";
import { currencySymbol, cn, formatCurrency, toDateKey, fmt } from "@/lib/utils";
import { billCategory, defaultWallet, nextDue } from "@/lib/money";
import { LIMITS } from "@/lib/limits";
import { AiInsights } from "@/components/ai/ai-insights";
import { tr } from "@/lib/i18n";

const RECURRENCES = ["monthly", "weekly", "yearly", "once"];

const field =
  "min-h-[44px] rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";
const select = "min-h-[44px] cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink/80 outline-hidden focus:border-amber/50";

export default function BillsPage() {
  const { bills, categories, wallets, walletsReady, createBill, removeBill, payBill, undoBillPayment, unpayBill, pushToast, loading } =
    useAppData();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(toDateKey(new Date()));
  const [recurrence, setRecurrence] = useState("monthly");
  const [categoryId, setCategoryId] = useState(""); // "" = matched by the bill's name
  const [walletId, setWalletId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const liveWallets = wallets.filter((w) => !w.archived);

  const add = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !(amt > 0) || !due) return;
    setError("");
    try {
      await createBill({
        name: name.trim(),
        amount: amt,
        dueOn: due,
        recurrence,
        isPaid: false,
        categoryId: categoryId || null,
        walletId: walletId || null,
      });
      setName("");
      setAmount("");
    } catch (err) {
      setError(message(err));
    }
  };

  // Ticking a bill adds it to the ledger; a repeating one moves to its next due date.
  const pay = async (b: Bill) => {
    if (busy) return;
    setBusy(b.id);
    setError("");
    try {
      const payment = await payBill(b.id);
      const next = nextDue(b.dueOn, b.recurrence);
      pushToast({
        message:
          tr("Paid {name} — {amount} added to the ledger.", { name: b.name, amount: formatCurrency(b.amount) }) +
          (next ? ` ${tr("Next due {date}.", { date: fmt(parseISO(next), "MMM d") })}` : ""),
        action: { label: tr("Undo"), run: () => undoBillPayment(payment).catch((err) => setError(message(err))) },
      });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const unpay = async (b: Bill) => {
    const ask = b.lastPaidTxn
      ? `Mark "${b.name}" unpaid and take its ${formatCurrency(b.amount)} expense back off the ledger?`
      : `Mark "${b.name}" unpaid?`;
    if (!window.confirm(ask)) return;
    setError("");
    try {
      await unpayBill(b.id, true);
    } catch (err) {
      setError(message(err));
    }
  };

  const upcomingTotal = bills.filter((b) => !b.isPaid).reduce((s, b) => s + b.amount, 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{tr("Bills · {n} unpaid", { n: bills.filter((b) => !b.isPaid).length })}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Upcoming")}{" "}<span className="serif-italic text-amber/90">{tr("dues.")}</span>
        </h1>
        {upcomingTotal > 0 && (
          <p className="mt-3 font-mono text-sm text-ink/45">{tr("{amount} outstanding", { amount: formatCurrency(upcomingTotal) })}</p>
        )}
        <p className="mt-2 max-w-xl text-sm text-ink/45">
          {tr("Tick a bill when you pay it: it's added to your ledger as an expense, and a repeating bill moves on to its next due date.")}
        </p>
      </div>

      <AiInsights topics={["bills"]} />

      <div className="card mb-6 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr("Bill (e.g. Internet)")}
            maxLength={LIMITS.name}
            aria-label={tr("Bill name")}
            className={cn(field, "flex-1")}
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
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={tr("Due date")} className={cn(field, "text-ink/70")} />
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} aria-label={tr("Recurrence")} className={cn(select, "capitalize")}>
            {RECURRENCES.map((r) => (
              <option key={r} value={r} className="bg-card">
                {tr(r[0].toUpperCase() + r.slice(1))}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Category and wallet need the database's wallets update; before it, bills work as they did. */}
          {walletsReady && (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label={tr("Logged as")} className={select}>
              <option value="" className="bg-card">
                {tr("Category: {name} (auto)", { name: tr(billCategory({ categoryId: null, name: name || "—" }, categories)?.name ?? "Other") })}
              </option>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id} className="bg-card">
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {walletsReady && liveWallets.length > 0 && (
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} aria-label={tr("Paid from")} className={select}>
              <option value="" className="bg-card">{tr("Paid from: {x}", { x: defaultWallet(wallets)?.name })}</option>
              {liveWallets.map((w) => (
                <option key={w.id} value={w.id} className="bg-card">{tr("Paid from: {name}", { name: tr(w.name) })}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => void add()}
            disabled={!name.trim() || !(parseFloat(amount) > 0)}
            className="entry-btn ml-auto inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />{" "}{tr("Add")}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
          {error}
        </p>
      )}

      {!loading && bills.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-ink/40">{tr("No bills tracked yet.")}</div>
      )}

      <div className="card divide-y divide-line overflow-hidden">
        {bills.map((b) =>
          editing === b.id ? (
            <BillEditor key={b.id} bill={b} onDone={() => setEditing(null)} />
          ) : (
            <BillRow
              key={b.id}
              bill={b}
              busy={busy === b.id}
              onToggle={() => void (b.isPaid ? unpay(b) : pay(b))}
              onEdit={() => setEditing(b.id)}
              onDelete={() => {
                if (window.confirm(tr("Delete the bill \"{name}\"? Payments already in the ledger stay.", { name: b.name }))) void removeBill(b.id);
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

const message = (err: unknown) =>
  typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : tr("Something went wrong — try again.");

function BillRow({
  bill: b,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  bill: Bill;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { categories, wallets, walletsReady } = useAppData();
  const days = differenceInCalendarDays(parseISO(b.dueOn), new Date());
  const soon = !b.isPaid && days <= 3;
  const cat = billCategory(b, categories);
  const wallet = walletsReady ? (wallets.find((w) => w.id === b.walletId) ?? defaultWallet(wallets)) : null;
  return (
    <div className="flex items-center gap-3 p-4">
      <button
        onClick={onToggle}
        disabled={busy}
        aria-label={b.isPaid ? tr("Mark {name} unpaid", { name: b.name }) : tr("Pay {name}", { name: b.name })}
        title={b.isPaid ? tr("Mark unpaid") : tr("Paid — add it to the ledger")}
        className={cn(
          "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:opacity-50",
          b.isPaid ? "border-income bg-income/20 text-income" : "border-line text-transparent hover:border-ink/30 hover:text-ink/30",
        )}
      >
        <Check className="h-4 w-4" aria-hidden strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm", b.isPaid ? "text-ink/40 line-through" : "text-ink/85")}>{b.name}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-ink/40">
          <span>{tr(b.recurrence[0].toUpperCase() + b.recurrence.slice(1))}</span>
          <span>·</span>
          <span className={soon ? "text-expense" : ""}>
            {b.isPaid ? tr("paid") : days < 0 ? tr("{n}d overdue", { n: -days }) : days === 0 ? tr("due today") : tr("in {n}d", { n: days })}
          </span>
          <span>· {fmt(parseISO(b.dueOn), "MMM d")}</span>
          {cat && <span className="truncate">· {cat.name}</span>}
          {wallet && <span className="truncate">· {tr(wallet.name)}</span>}
        </div>
      </div>
      {soon && <Bell className="h-3.5 w-3.5 text-expense" aria-hidden />}
      <span className="font-mono text-sm tabular text-ink/80">{formatCurrency(b.amount)}</span>
      <button
        onClick={onEdit}
        aria-label={tr("Edit {name}", { name: b.name })}
        className="cursor-pointer rounded-lg p-1 text-ink/35 transition-colors hover:bg-ink/5 hover:text-amber"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button onClick={onDelete} aria-label={tr("Delete {name}", { name: b.name })} className="cursor-pointer text-ink/30 transition-colors hover:text-expense">
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function BillEditor({ bill, onDone }: { bill: Bill; onDone: () => void }) {
  const { categories, wallets, walletsReady, editBill } = useAppData();
  const [name, setName] = useState(bill.name);
  const [amount, setAmount] = useState(String(bill.amount));
  const [due, setDue] = useState(bill.dueOn);
  const [recurrence, setRecurrence] = useState(bill.recurrence);
  const [categoryId, setCategoryId] = useState(bill.categoryId ?? "");
  const [walletId, setWalletId] = useState(bill.walletId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const amt = parseFloat(amount);
  const valid = !!name.trim() && amt > 0 && /^\d{4}-\d{2}-\d{2}$/.test(due);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await editBill(bill.id, {
        name: name.trim(),
        amount: Math.round(amt * 100) / 100,
        dueOn: due,
        recurrence,
        ...(walletsReady ? { categoryId: categoryId || null, walletId: walletId || null } : {}),
      });
      onDone();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 bg-ink/[0.02] p-4" role="group" aria-label={tr("Edit {name}", { name: bill.name })}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} aria-label={tr("Bill name")} className={cn(field, "flex-1")} />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
          <span className="font-mono text-ink/40">{currencySymbol()}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            aria-label={tr("Amount")}
            className="min-h-[44px] w-24 bg-transparent font-mono text-sm text-ink outline-hidden"
          />
        </div>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={tr("Due date")} className={cn(field, "text-ink/70")} />
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} aria-label={tr("Recurrence")} className={cn(select, "capitalize")}>
          {RECURRENCES.map((r) => (
            <option key={r} value={r} className="bg-card">
              {tr(r[0].toUpperCase() + r.slice(1))}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {walletsReady && (
          <>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label={tr("Logged as")} className={select}>
              <option value="" className="bg-card">
                {tr("Category: {name} (auto)", { name: tr(billCategory({ categoryId: null, name }, categories)?.name ?? "Other") })}
              </option>
              {categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <option key={c.id} value={c.id} className="bg-card">
                    {c.name}
                  </option>
                ))}
            </select>
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} aria-label={tr("Paid from")} className={select}>
              <option value="" className="bg-card">{tr("Paid from: {x}", { x: defaultWallet(wallets)?.name })}</option>
              {wallets
                .filter((w) => !w.archived || w.id === walletId)
                .map((w) => (
                  <option key={w.id} value={w.id} className="bg-card">{tr("Paid from: {name}", { name: tr(w.name) })}</option>
                ))}
            </select>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={onDone}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />{" "}{tr("Cancel")}
          </button>
          <button
            onClick={() => void save()}
            disabled={!valid || saving}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
          >
            {tr("Save")}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-xs text-expense" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
