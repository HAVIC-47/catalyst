// Money rules shared by the pages: wallet balances, what's left on a debt, when a
// bill is due next and what paying it is logged as, and budget use.
import { addDays, addMonths, addYears, format, parseISO } from "date-fns";
import type { Bill, Budget, Category, Debt, DebtPayment, Transaction, Transfer, Wallet } from "@/types";

const cents = (n: number) => Math.round(n * 100) / 100;

/** Entries and debts without a wallet belong to this one: the first that isn't archived. */
export function defaultWallet(wallets: Wallet[]): Wallet | null {
  const live = wallets.filter((w) => !w.archived).sort((a, b) => a.sort - b.sort);
  return live[0] ?? wallets[0] ?? null;
}

/**
 * Each wallet's balance: opening balance + income − expenses, ± transfers, ± dhar
 * (lending takes money out, getting it back puts it in; borrowing the reverse).
 * Savings entries stay in the savings pool — move money with a transfer instead.
 */
export function walletBalances(
  wallets: Wallet[],
  transactions: Transaction[],
  transfers: Transfer[],
  debts: Debt[],
  payments: DebtPayment[],
): Map<string, number> {
  const fallback = defaultWallet(wallets)?.id ?? null;
  const out = new Map<string, number>(wallets.map((w) => [w.id, w.openingBalance]));
  const add = (id: string | null, amount: number) => {
    const key = id && out.has(id) ? id : fallback;
    if (key) out.set(key, (out.get(key) ?? 0) + amount);
  };
  for (const t of transactions) {
    if (t.kind === "income") add(t.walletId, t.amount);
    else if (t.kind === "expense") add(t.walletId, -t.amount);
  }
  for (const t of transfers) {
    add(t.fromWallet, -t.amount);
    add(t.toWallet, t.amount);
  }
  const debtById = new Map(debts.map((d) => [d.id, d]));
  for (const d of debts) add(d.walletId, d.direction === "lent" ? -d.amount : d.amount);
  for (const p of payments) {
    const d = debtById.get(p.debtId);
    if (d) add(p.walletId, d.direction === "lent" ? p.amount : -p.amount);
  }
  for (const [k, v] of out) out.set(k, cents(v));
  return out;
}

/** What's still owed on a debt (never below zero). */
export function debtRemaining(debt: Debt, payments: DebtPayment[]): number {
  const paid = payments.filter((p) => p.debtId === debt.id).reduce((s, p) => s + p.amount, 0);
  return Math.max(0, cents(debt.amount - paid));
}

/** Open = not closed and something is still owed. */
export function debtIsOpen(debt: Debt, payments: DebtPayment[]): boolean {
  return !debt.closed && debtRemaining(debt, payments) > 0;
}

/** The next due date after paying the one on `dueOn` ("once" bills don't repeat). */
export function nextDue(dueOn: string, recurrence: string): string | null {
  const d = parseISO(dueOn);
  switch (recurrence) {
    case "weekly":
      return format(addDays(d, 7), "yyyy-MM-dd");
    case "monthly":
      return format(addMonths(d, 1), "yyyy-MM-dd");
    case "yearly":
      return format(addYears(d, 1), "yyyy-MM-dd");
    default:
      return null;
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The expense category a bill's payment is logged under: its own, one named like it, Utilities, or Other. */
export function billCategory(bill: Pick<Bill, "categoryId" | "name">, categories: Category[]): Category | null {
  const expense = categories.filter((c) => c.kind === "expense");
  return (
    expense.find((c) => c.id === bill.categoryId) ??
    expense.find((c) => same(c.name, bill.name)) ??
    expense.find((c) => same(c.name, "Utilities")) ??
    expense.find((c) => same(c.name, "Other")) ??
    expense[0] ??
    null
  );
}

/** How much of a monthly budget this month's expenses have used. */
export function budgetUse(budget: Budget, transactions: Transaction[], now = new Date()): { spent: number; ratio: number } {
  const month = format(now, "yyyy-MM");
  const spent = transactions
    .filter((t) => t.kind === "expense" && t.occurredOn.startsWith(month))
    .filter((t) => (budget.categoryId ? t.categoryId === budget.categoryId || same(t.categoryName, budget.categoryName) : true))
    .reduce((s, t) => s + t.amount, 0);
  return { spent: cents(spent), ratio: budget.amount > 0 ? spent / budget.amount : 0 };
}
