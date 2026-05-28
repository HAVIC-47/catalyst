import { createClient } from "@/lib/supabase/client";
import type { Bill, NewBill } from "@/types";

interface Row {
  id: string;
  name: string;
  amount: number | string;
  due_on: string;
  recurrence: string;
  is_paid: boolean;
}
const toBill = (r: Row): Bill => ({
  id: r.id,
  name: r.name,
  amount: typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
  dueOn: r.due_on,
  recurrence: r.recurrence,
  isPaid: r.is_paid,
});

export async function listBills(): Promise<Bill[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .order("due_on", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toBill);
}

export async function addBill(input: NewBill): Promise<Bill> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bills")
    .insert({
      name: input.name,
      amount: input.amount,
      due_on: input.dueOn,
      recurrence: input.recurrence,
      is_paid: input.isPaid,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toBill(data as Row);
}

export async function updateBill(id: string, patch: Partial<NewBill>): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.dueOn !== undefined) row.due_on = patch.dueOn;
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence;
  if (patch.isPaid !== undefined) row.is_paid = patch.isPaid;
  const { error } = await supabase.from("bills").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteBill(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) throw error;
}
