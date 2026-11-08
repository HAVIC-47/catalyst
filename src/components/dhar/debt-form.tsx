"use client";

// Adding or changing a dhar record: the Dhar page, a loan's Edit, and a calendar day's Dhar tab.
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { Debt, DebtDirection } from "@/types";
import { cn, currencySymbol, toDateKey } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { WalletSelect, rememberWallet, useStartWallet } from "@/components/entry/wallet-select";
import { tr } from "@/lib/i18n";

const field =
  "min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";

const message = (err: unknown) =>
  typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : tr("Something went wrong — try again.");

export function DebtForm({ debt, date: day, onDone }: { debt?: Debt; date?: string; onDone?: () => void }) {
  const { createDebt, editDebt } = useAppData();
  const start = useStartWallet();
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? "lent");
  const [person, setPerson] = useState(debt?.person ?? "");
  const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
  const [walletId, setWalletId] = useState<string | null>(debt?.walletId ?? null);
  const [date, setDate] = useState(debt?.occurredOn ?? day ?? toDateKey(new Date()));
  const [due, setDue] = useState(debt?.dueOn ?? "");
  const [note, setNote] = useState(debt?.note ?? "");
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
      const fields = {
        person: person.trim(),
        direction,
        amount: Math.round(value * 100) / 100,
        note: note.trim(),
        walletId: wallet,
        occurredOn: date,
        dueOn: due || null,
      };
      if (debt) await editDebt(debt.id, fields);
      else await createDebt({ ...fields, closed: false });
      rememberWallet(wallet);
      // Where the form goes away after a save (an Edit, a calendar day), that's the last thing it does.
      if (onDone) {
        onDone();
        return;
      }
      setPerson("");
      setAmount("");
      setDue("");
      setNote("");
      setSaving(false);
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  };

  return (
    <section className={cn("space-y-4", !debt && !day && "card mb-6 p-5")} aria-label={debt ? tr("Edit dhar") : tr("New dhar")}>
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
      <div className="flex justify-end gap-2">
        {debt && onDone && (
          <button onClick={onDone} className="min-h-[44px] cursor-pointer rounded-xl px-4 text-sm text-ink/60 hover:bg-ink/[0.04]">
            {tr("Cancel")}
          </button>
        )}
        <button
          onClick={() => void add()}
          disabled={!valid || saving}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper disabled:opacity-40"
        >
          {debt ? (
            tr("Save")
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />{" "}{tr("Add")}
            </>
          )}
        </button>
      </div>
    </section>
  );
}
