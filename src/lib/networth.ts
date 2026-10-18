// Net worth: what's in the wallets, plus dhar owed to you, minus dhar you owe —
// on any day, worked out from the entries, so the history needs nothing stored.
// Shared with the Android app (lib/util/networth.dart).
import type { Debt, DebtPayment, Transaction, Wallet } from "@/types";
import { addDaysKey } from "./recurring";

type Tx = Pick<Transaction, "kind" | "amount" | "occurredOn">;
type DebtLike = Pick<Debt, "id" | "direction" | "amount" | "occurredOn" | "closed">;
type PaymentLike = Pick<DebtPayment, "debtId" | "amount" | "paidOn">;

export interface NetWorth {
  date: string;
  cash: number; // every wallet's balance (transfers between them change nothing)
  owedToYou: number;
  youOwe: number;
  total: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Net worth at the end of `date`. A closed debt with something left (written off)
 *  stops counting after its last payment. */
export function netWorthOn(
  date: string,
  wallets: Pick<Wallet, "openingBalance">[],
  transactions: Tx[],
  debts: DebtLike[],
  payments: PaymentLike[],
): NetWorth {
  let cash = wallets.reduce((s, w) => s + w.openingBalance, 0);
  for (const t of transactions) {
    if (t.occurredOn > date) continue;
    if (t.kind === "income") cash += t.amount;
    else if (t.kind === "expense") cash -= t.amount;
  }
  let owedToYou = 0;
  let youOwe = 0;
  const byDebt = new Map<string, PaymentLike[]>();
  for (const p of payments) (byDebt.get(p.debtId) ?? byDebt.set(p.debtId, []).get(p.debtId)!).push(p);
  for (const d of debts) {
    if (d.occurredOn > date) continue;
    const lent = d.direction === "lent";
    cash += lent ? -d.amount : d.amount;
    const pays = byDebt.get(d.id) ?? [];
    let paid = 0;
    for (const p of pays) {
      if (p.paidOn > date) continue;
      paid += p.amount;
      cash += lent ? p.amount : -p.amount;
    }
    const lastActivity = pays.reduce((m, p) => (p.paidOn > m ? p.paidOn : m), d.occurredOn);
    const left = d.closed && date >= lastActivity ? 0 : Math.max(0, d.amount - paid);
    if (lent) owedToYou += left;
    else youOwe += left;
  }
  cash = cents(cash);
  owedToYou = cents(owedToYou);
  youOwe = cents(youOwe);
  return { date, cash, owedToYou, youOwe, total: cents(cash + owedToYou - youOwe) };
}

/** Net worth at the end of each month — up to `months` of them, from the first
 *  month with an entry — with today as the last point. */
export function netWorthSeries(
  today: string,
  months: number,
  wallets: Pick<Wallet, "openingBalance">[],
  transactions: Tx[],
  debts: DebtLike[],
  payments: PaymentLike[],
): NetWorth[] {
  const first = [...transactions.map((t) => t.occurredOn), ...debts.map((d) => d.occurredOn)].reduce((m, k) => (k < m ? k : m), today);
  const [ty, tm] = today.split("-").map(Number);
  const [fy, fm] = first.split("-").map(Number);
  const span = Math.min(months, (ty - fy) * 12 + (tm - fm) + 1);
  const out: NetWorth[] = [];
  for (let i = span - 1; i >= 1; i--) {
    // the last day of the month i months back = the day before the 1st of the month after it
    const index = ty * 12 + (tm - 1) - i + 1;
    const firstOfNext = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
    out.push(netWorthOn(addDaysKey(firstOfNext, -1), wallets, transactions, debts, payments));
  }
  out.push(netWorthOn(today, wallets, transactions, debts, payments));
  return out;
}
