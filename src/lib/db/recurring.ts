import { createClient } from "@/lib/supabase/client";
import type { NewRecurringRule, NewTransaction, RecurringRule, Transaction } from "@/types";
import { toRow, toTx } from "@/lib/db/transactions";

interface Row {
  id: string;
  name: string;
  kind: "expense" | "income";
  amount: number | string;
  category_id: string | null;
  wallet_id: string | null;
  frequency: RecurringRule["frequency"];
  every: number;
  day1: number;
  day2: number | null;
  at_time: string;
  start_on: string;
  end_on: string | null;
  next_on: string;
  paused: boolean;
  tz: string;
  created_at: string;
}
const toRule = (r: Row): RecurringRule => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  amount: typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
  categoryId: r.category_id,
  walletId: r.wallet_id,
  frequency: r.frequency,
  every: r.every ?? 1,
  day1: r.day1,
  day2: r.day2 ?? null,
  time: r.at_time,
  startOn: r.start_on,
  endOn: r.end_on ?? null,
  nextOn: r.next_on,
  paused: r.paused,
  tz: r.tz,
  createdAt: r.created_at,
});
const fromRule = (p: Partial<NewRecurringRule>) => {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.amount !== undefined) row.amount = p.amount;
  if (p.categoryId !== undefined) row.category_id = p.categoryId;
  if (p.walletId !== undefined) row.wallet_id = p.walletId;
  if (p.frequency !== undefined) row.frequency = p.frequency;
  if (p.every !== undefined) row.every = p.every;
  if (p.day1 !== undefined) row.day1 = p.day1;
  if (p.day2 !== undefined) row.day2 = p.day2;
  if (p.time !== undefined) row.at_time = p.time;
  if (p.startOn !== undefined) row.start_on = p.startOn;
  if (p.endOn !== undefined) row.end_on = p.endOn;
  if (p.nextOn !== undefined) row.next_on = p.nextOn;
  if (p.paused !== undefined) row.paused = p.paused;
  if (p.tz !== undefined) row.tz = p.tz;
  return row;
};

export async function listRecurring(): Promise<RecurringRule[]> {
  const { data, error } = await createClient().from("recurring").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toRule);
}

export async function addRecurring(input: NewRecurringRule): Promise<RecurringRule> {
  const { data, error } = await createClient().from("recurring").insert(fromRule(input)).select("*").single();
  if (error) throw error;
  return toRule(data as Row);
}

export async function updateRecurring(id: string, patch: Partial<NewRecurringRule>): Promise<void> {
  const { error } = await createClient().from("recurring").update(fromRule(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await createClient().from("recurring").delete().eq("id", id);
  if (error) throw error;
}

/** Logs one of a rule's dates. Null when that date is already in the ledger — the
 *  database keeps one entry per rule and date, whoever logs it first. */
export async function logRecurring(ruleId: string, date: string, entry: NewTransaction): Promise<Transaction | null> {
  const { data, error } = await createClient()
    .from("transactions")
    .insert({ ...toRow(entry), recurring_id: ruleId, recurring_on: date })
    .select("*")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw error;
  return toTx(data as Parameters<typeof toTx>[0]);
}

/** Moves a rule on to `nextOn` — never back, if another device got further first. */
export async function advanceRecurring(id: string, nextOn: string): Promise<void> {
  const { error } = await createClient().from("recurring").update({ next_on: nextOn }).eq("id", id).lt("next_on", nextOn);
  if (error) throw error;
}
