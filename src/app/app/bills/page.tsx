"use client";

import { useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Plus, Trash2, Check, Bell } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { TAKA, cn, formatCurrency, toDateKey } from "@/lib/utils";

const RECURRENCES = ["monthly", "weekly", "yearly", "once"];

export default function BillsPage() {
  const { bills, createBill, editBill, removeBill, loading } = useAppData();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(toDateKey(new Date()));
  const [recurrence, setRecurrence] = useState("monthly");

  const add = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !(amt > 0) || !due) return;
    await createBill({ name: name.trim(), amount: amt, dueOn: due, recurrence, isPaid: false });
    setName("");
    setAmount("");
  };

  const upcomingTotal = bills.filter((b) => !b.isPaid).reduce((s, b) => s + b.amount, 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">Bills · {bills.filter((b) => !b.isPaid).length} unpaid</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          Upcoming <span className="serif-italic text-amber/90">dues.</span>
        </h1>
        {upcomingTotal > 0 && (
          <p className="mt-3 font-mono text-sm text-white/45">{formatCurrency(upcomingTotal)} outstanding</p>
        )}
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-2 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bill (e.g. Internet)"
          aria-label="Bill name"
          className="min-h-[44px] flex-1 rounded-xl border border-line bg-white/[0.02] px-3 text-sm text-white outline-none focus:border-amber/50"
        />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 focus-within:border-amber/50">
          <span className="font-mono text-white/40">{TAKA}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Amount"
            aria-label="Amount"
            className="min-h-[44px] w-24 bg-transparent font-mono text-sm text-white outline-none"
          />
        </div>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Due date"
          className="min-h-[44px] rounded-xl border border-line bg-white/[0.02] px-3 text-sm text-white/70 outline-none focus:border-amber/50 [color-scheme:dark]"
        />
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value)}
          aria-label="Recurrence"
          className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-card px-3 text-sm capitalize text-white/80 outline-none focus:border-amber/50"
        >
          {RECURRENCES.map((r) => (
            <option key={r} value={r} className="bg-card">
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!name.trim() || !(parseFloat(amount) > 0)}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Add
        </button>
      </div>

      {!loading && bills.length === 0 && (
        <div className="card px-6 py-16 text-center text-sm text-white/40">No bills tracked yet.</div>
      )}

      <div className="card divide-y divide-line overflow-hidden">
        {bills.map((b) => {
          const days = differenceInCalendarDays(parseISO(b.dueOn), new Date());
          const soon = !b.isPaid && days <= 3;
          return (
            <div key={b.id} className="flex items-center gap-3 p-4">
              <button
                onClick={() => editBill(b.id, { isPaid: !b.isPaid })}
                aria-label={b.isPaid ? "Mark unpaid" : "Mark paid"}
                className={cn(
                  "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors",
                  b.isPaid ? "border-income bg-income/20 text-income" : "border-line text-transparent hover:border-white/30",
                )}
              >
                <Check className="h-4 w-4" aria-hidden strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm", b.isPaid ? "text-white/40 line-through" : "text-white/85")}>
                  {b.name}
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-white/40">
                  <span className="capitalize">{b.recurrence}</span>
                  <span>·</span>
                  <span className={soon ? "text-expense" : ""}>
                    {b.isPaid ? "paid" : days < 0 ? `${-days}d overdue` : days === 0 ? "due today" : `in ${days}d`}
                  </span>
                  <span>· {format(parseISO(b.dueOn), "MMM d")}</span>
                </div>
              </div>
              {soon && <Bell className="h-3.5 w-3.5 text-expense" aria-hidden />}
              <span className="font-mono text-sm tabular text-white/80">{formatCurrency(b.amount)}</span>
              <button
                onClick={() => removeBill(b.id)}
                aria-label="Delete bill"
                className="cursor-pointer text-white/30 transition-colors hover:text-expense"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
