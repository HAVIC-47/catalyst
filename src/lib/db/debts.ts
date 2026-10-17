import { createClient } from "@/lib/supabase/client";
import type { Debt, DebtDirection, DebtPayment, NewDebt, NewDebtPayment } from "@/types";

const num = (v: number | string) => (typeof v === "string" ? parseFloat(v) : v);

interface DebtRow {
  id: string;
  person: string;
  direction: DebtDirection;
  amount: number | string;
  note: string;
  wallet_id: string | null;
  occurred_on: string;
  due_on: string | null;
  closed: boolean;
  created_at: string;
}
const toDebt = (r: DebtRow): Debt => ({
  id: r.id,
  person: r.person,
  direction: r.direction,
  amount: num(r.amount),
  note: r.note,
  walletId: r.wallet_id,
  occurredOn: r.occurred_on,
  dueOn: r.due_on,
  closed: r.closed,
  createdAt: r.created_at,
});

export async function listDebts(): Promise<Debt[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("debts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DebtRow[]).map(toDebt);
}

export async function addDebt(input: NewDebt): Promise<Debt> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("debts")
    .insert({
      person: input.person,
      direction: input.direction,
      amount: input.amount,
      note: input.note,
      wallet_id: input.walletId,
      occurred_on: input.occurredOn,
      due_on: input.dueOn,
      closed: input.closed,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDebt(data as DebtRow);
}

export async function updateDebt(id: string, patch: Partial<NewDebt>): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.person !== undefined) row.person = patch.person;
  if (patch.direction !== undefined) row.direction = patch.direction;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.walletId !== undefined) row.wallet_id = patch.walletId;
  if (patch.occurredOn !== undefined) row.occurred_on = patch.occurredOn;
  if (patch.dueOn !== undefined) row.due_on = patch.dueOn;
  if (patch.closed !== undefined) row.closed = patch.closed;
  const { error } = await supabase.from("debts").update(row).eq("id", id);
  if (error) throw error;
}

/** Its payments go with it. */
export async function deleteDebt(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw error;
}

interface PaymentRow {
  id: string;
  debt_id: string;
  amount: number | string;
  wallet_id: string | null;
  paid_on: string;
  note: string;
  created_at: string;
}
const toPayment = (r: PaymentRow): DebtPayment => ({
  id: r.id,
  debtId: r.debt_id,
  amount: num(r.amount),
  walletId: r.wallet_id,
  paidOn: r.paid_on,
  note: r.note,
  createdAt: r.created_at,
});

export async function listDebtPayments(): Promise<DebtPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("debt_payments").select("*").order("paid_on", { ascending: true });
  if (error) throw error;
  return (data as PaymentRow[]).map(toPayment);
}

export async function addDebtPayment(input: NewDebtPayment): Promise<DebtPayment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("debt_payments")
    .insert({ debt_id: input.debtId, amount: input.amount, wallet_id: input.walletId, paid_on: input.paidOn, note: input.note })
    .select("*")
    .single();
  if (error) throw error;
  return toPayment(data as PaymentRow);
}

export async function deleteDebtPayment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("debt_payments").delete().eq("id", id);
  if (error) throw error;
}
