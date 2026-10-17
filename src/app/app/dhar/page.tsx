"use client";

// Dhar / baki — money you lent (they owe you) or borrowed (you owe them): friends,
// family, shop credit. Part payments until it's settled; it moves money in and out
// of a wallet but never counts as spending or income.
import { useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Check, ChevronDown, HandCoins, Plus, Trash2, Undo2 } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { Debt, DebtDirection } from "@/types";
import { cn, currencySymbol, formatCurrency, toDateKey, fmt } from "@/lib/utils";
import { debtIsOpen, debtRemaining, defaultWallet } from "@/lib/money";
import { LIMITS } from "@/lib/limits";
import { WalletSelect, rememberWallet, useStartWallet } from "@/components/entry/wallet-select";
import { tr, trn } from "@/lib/i18n";

const field =
  "min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";

const message = (err: unknown) =>
  typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : tr("Something went wrong — try again.");

export default function DharPage() {
  const { debts, debtPayments, walletsReady, loading } = useAppData();
  const [showClosed, setShowClosed] = useState(false);

  const open = debts.filter((d) => debtIsOpen(d, debtPayments));
  const closed = debts.filter((d) => !debtIsOpen(d, debtPayments));
  const owedToYou = open.filter((d) => d.direction === "lent").reduce((s, d) => s + debtRemaining(d, debtPayments), 0);
  const youOwe = open.filter((d) => d.direction === "borrowed").reduce((s, d) => s + debtRemaining(d, debtPayments), 0);

  // One group per person, biggest balance first.
  const people = useMemo(() => {
    const m = new Map<string, Debt[]>();
    for (const d of open) {
      const k = d.person.trim().toLowerCase();
      (m.get(k) ?? m.set(k, []).get(k)!).push(d);
    }
    return [...m.values()]
      .map((list) => {
        const net = list.reduce((s, d) => s + (d.direction === "lent" ? 1 : -1) * debtRemaining(d, debtPayments), 0);
        return { person: list[0].person, list, net };
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [open, debtPayments]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{tr("Dhar · baki · {n} open", { n: open.length })}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Who owes")}{" "}<span className="serif-italic text-amber/90">{tr("who.")}</span>
        </h1>
        {(owedToYou > 0 || youOwe > 0) && (
          <p className="mt-3 font-mono text-sm">
            <span className="text-income">{tr("Owed to you {amount}", { amount: formatCurrency(owedToYou) })}</span>
            <span className="text-ink/30"> · </span>
            <span className="text-expense">{tr("You owe {amount}", { amount: formatCurrency(youOwe) })}</span>
          </p>
        )}
      </div>

      {!loading && !walletsReady ? (
        <div className="card max-w-xl p-6 text-sm leading-relaxed text-ink/60">
          {tr("Dhar needs a database update. In Supabase, open the SQL editor and run")}{" "}<span className="font-mono text-ink/80">db/supabase.sql</span>{" "}
          {tr("and then")}{" "}<span className="font-mono text-ink/80">db/security.sql</span>{" "}{tr("from the web repo — then reload this page.")}
        </div>
      ) : (
        <>
          <NewDebt />

          {!loading && open.length === 0 && (
            <div className="card mb-6 px-6 py-12 text-center text-sm text-ink/40">
              <HandCoins className="mx-auto mb-3 h-6 w-6 text-ink/25" aria-hidden />
              {tr("Nothing owed either way. Add money you lent or borrowed above.")}
            </div>
          )}

          <div className="space-y-4">
            {people.map((g) => (
              <section key={g.person} className="card overflow-hidden" aria-label={g.person}>
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                  <span className="truncate font-medium text-ink">{g.person}</span>
                  <span className={cn("shrink-0 font-mono text-sm", g.net >= 0 ? "text-income" : "text-expense")}>
                    {g.net >= 0 ? tr("owes you {amount}", { amount: formatCurrency(g.net) }) : tr("you owe {amount}", { amount: formatCurrency(-g.net) })}
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {g.list.map((d) => (
                    <DebtRow key={d.id} debt={d} />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {closed.length > 0 && (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setShowClosed((s) => !s)}
                aria-expanded={showClosed}
                className="label inline-flex cursor-pointer items-center gap-1.5 hover:text-ink/70"
              >
                {tr("Settled · {n}", { n: closed.length })}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showClosed && "rotate-180")} aria-hidden />
              </button>
              {showClosed && (
                <ul className="card mt-3 divide-y divide-line overflow-hidden">
                  {closed.map((d) => (
                    <DebtRow key={d.id} debt={d} settled />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewDebt() {
  const { createDebt } = useAppData();
  const start = useStartWallet();
  const [direction, setDirection] = useState<DebtDirection>("lent");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<string | null>(null);
  const [date, setDate] = useState(toDateKey(new Date()));
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const value = parseFloat(amount);
  const valid = person.trim() && value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const add = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const wallet = walletId ?? start;
      await createDebt({
        person: person.trim(),
        direction,
        amount: Math.round(value * 100) / 100,
        note: note.trim(),
        walletId: wallet,
        occurredOn: date,
        dueOn: due || null,
        closed: false,
      });
      rememberWallet(wallet);
      setPerson("");
      setAmount("");
      setDue("");
      setNote("");
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card mb-6 space-y-4 p-5" aria-label={tr("New dhar")}>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink/[0.02] p-1" role="radiogroup" aria-label={tr("Direction")}>
        {(
          [
            { v: "lent", label: tr("I lent"), hint: tr("they owe me"), on: "text-income" },
            { v: "borrowed", label: tr("I borrowed"), hint: tr("I owe them"), on: "text-expense" },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={direction === o.v}
            onClick={() => setDirection(o.v)}
            className={cn(
              "flex min-h-[44px] cursor-pointer flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors duration-200",
              direction === o.v ? cn("bg-ink/[0.06]", o.on) : "text-ink/45 hover:text-ink/70",
            )}
          >
            {o.label}
            <span className="text-[10px] font-normal text-ink/40">{o.hint}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label mb-1.5 block">{direction === "lent" ? tr("Lent to") : tr("Borrowed from")}</span>
          <input value={person} onChange={(e) => setPerson(e.target.value)} maxLength={LIMITS.name} placeholder={tr("Name or shop")} aria-label={tr("Person")} className={field} />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">{tr("Amount")}</span>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
            <span className="font-mono text-ink/40">{currencySymbol()}</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              aria-label={tr("Amount")}
              className="min-h-[44px] w-full bg-transparent font-mono text-sm text-ink outline-hidden"
            />
          </div>
        </label>
        <label className="block">
          <span className="label mb-1.5 block">{tr("Date")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={tr("Date")} className={field} />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">{tr("Due back · optional")}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={tr("Due back")} className={field} />
        </label>
      </div>
      <WalletSelect value={walletId ?? start} onChange={setWalletId} label={direction === "lent" ? tr("Paid out of") : tr("Received into")} />
      <label className="block">
        <span className="label mb-1.5 block">{tr("Note · optional")}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={LIMITS.note} placeholder={tr("What it was for")} aria-label={tr("Note")} className={field} />
      </label>
      {error && (
        <p className="text-xs text-expense" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          onClick={() => void add()}
          disabled={!valid || saving}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />{" "}{tr("Add")}
        </button>
      </div>
    </section>
  );
}

function DebtRow({ debt: d, settled = false }: { debt: Debt; settled?: boolean }) {
  const { debtPayments, wallets, recordDebtPayment, removeDebtPayment, editDebt, removeDebt } = useAppData();
  const left = debtRemaining(d, debtPayments);
  const payments = debtPayments.filter((p) => p.debtId === d.id);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<string | null>(null);
  const [date, setDate] = useState(toDateKey(new Date()));
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lent = d.direction === "lent";
  const days = d.dueOn ? differenceInCalendarDays(parseISO(d.dueOn), new Date()) : null;
  const walletName = (id: string | null) => (wallets.find((w) => w.id === id) ?? defaultWallet(wallets))?.name ?? "";

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const pay = (value: number) =>
    run(async () => {
      await recordDebtPayment({
        debtId: d.id,
        amount: Math.round(value * 100) / 100,
        walletId: walletId ?? d.walletId ?? defaultWallet(wallets)?.id ?? null,
        paidOn: date,
        note: "",
      });
      setPaying(false);
      setAmount("");
    });

  const value = parseFloat(amount);

  return (
    <li className={cn("px-5 py-4", settled && "opacity-70")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            {settled && <span className="font-medium text-ink/80">{d.person} ·</span>}
            <span className={lent ? "text-income" : "text-expense"}>{lent ? tr("Lent") : tr("Borrowed")}</span>
            <span className="font-mono tabular text-ink/85">{formatCurrency(d.amount)}</span>
            <span className="font-mono text-[11px] text-ink/40">{fmt(parseISO(d.occurredOn), "MMM d, yyyy")}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-ink/40">
            {!settled && (
              <span className="text-ink/60">
                {lent ? tr("{amount} still to get back", { amount: formatCurrency(left) }) : tr("{amount} still to pay", { amount: formatCurrency(left) })}
              </span>
            )}
            {settled && <span>{d.closed && left > 0 ? tr("written off") : tr("settled")}</span>}
            {d.dueOn && !settled && (
              <span className={cn(days !== null && days < 0 && "text-expense", days !== null && days >= 0 && days <= 2 && "text-amber")}>
                · {tr("due {date}", { date: fmt(parseISO(d.dueOn), "MMM d") })}
                {days !== null && (days < 0 ? ` ${tr("({n}d late)", { n: -days })}` : days === 0 ? ` ${tr("(today)")}` : "")}
              </span>
            )}
            {wallets.length > 0 && <span>· {walletName(d.walletId)}</span>}
            {d.note && <span className="truncate">· {d.note}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!settled && (
            <>
              <button
                onClick={() => {
                  setPaying((p) => !p);
                  setAmount(String(left));
                }}
                className="inline-flex min-h-[36px] cursor-pointer items-center rounded-lg px-2.5 text-xs font-medium text-amber transition-colors hover:bg-amber/10"
              >
                {lent ? tr("Got some back") : tr("Paid some")}
              </button>
              <button
                onClick={() => void pay(left)}
                disabled={busy}
                title={tr("Settle in full")}
                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-income transition-colors hover:bg-income/10 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" aria-hidden strokeWidth={3} />{" "}{tr("Settle")}
              </button>
            </>
          )}
          {settled && d.closed && left > 0 && (
            <button
              onClick={() => void run(() => editDebt(d.id, { closed: false }))}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs text-ink/60 hover:bg-ink/[0.04]"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />{" "}{tr("Reopen")}
            </button>
          )}
          <button
            onClick={() => {
              const ask = lent
                ? tr("Delete this loan to {person} and its payments?", { person: d.person })
                : tr("Delete this loan from {person} and its payments?", { person: d.person });
              if (window.confirm(ask)) void run(() => removeDebt(d.id));
            }}
            aria-label={tr("Delete")}
            className="cursor-pointer rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-ink/5 hover:text-expense"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {paying && !settled && (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-ink/[0.02] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-amber/50">
              <span className="font-mono text-ink/40">{currencySymbol()}</span>
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                aria-label={tr("Payment amount")}
                className="min-h-[40px] w-full bg-transparent font-mono text-sm text-ink outline-hidden"
              />
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={tr("Payment date")} className={cn(field, "w-auto")} />
          </div>
          <WalletSelect value={walletId ?? d.walletId} onChange={setWalletId} label={lent ? tr("Received into") : tr("Paid out of")} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {left > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(tr("Write off the {amount} still owed? It's closed without a payment.", { amount: formatCurrency(left) })))
                    void run(() => editDebt(d.id, { closed: true }));
                }}
                className="mr-auto min-h-[40px] cursor-pointer rounded-xl px-3 text-xs text-ink/50 hover:bg-ink/[0.04] hover:text-ink"
              >
                {tr("Write off")}
              </button>
            )}
            <button onClick={() => setPaying(false)} className="min-h-[40px] cursor-pointer rounded-xl px-3 text-sm text-ink/60 hover:bg-ink/[0.04]">
              {tr("Cancel")}
            </button>
            <button
              onClick={() => void pay(Math.min(value, left))}
              disabled={!(value > 0) || busy}
              className="entry-btn inline-flex min-h-[40px] cursor-pointer items-center rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
            >
              {tr("Record")}
            </button>
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            aria-expanded={showHistory}
            className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-ink/40 hover:text-ink/70"
          >
            {trn(payments.length, "{n} payment", "{n} payments")}
            <ChevronDown className={cn("h-3 w-3 transition-transform", showHistory && "rotate-180")} aria-hidden />
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1">
              {payments.map((p) => (
                <li key={p.id} className="group flex items-center gap-3 font-mono text-[11px] text-ink/55">
                  <span className="w-16">{fmt(parseISO(p.paidOn), "MMM d")}</span>
                  <span className="tabular text-ink/75">{formatCurrency(p.amount)}</span>
                  {wallets.length > 0 && <span>· {walletName(p.walletId)}</span>}
                  <button
                    onClick={() => {
                      if (window.confirm(tr("Remove this payment?"))) void run(() => removeDebtPayment(p.id));
                    }}
                    aria-label={tr("Remove payment")}
                    className="ml-auto cursor-pointer text-ink/0 transition-colors group-hover:text-ink/35 hover:text-expense! focus-visible:text-ink/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-expense" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
