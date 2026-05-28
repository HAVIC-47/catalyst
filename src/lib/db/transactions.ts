import { createClient } from "@/lib/supabase/client";
import type { NewTransaction, Transaction } from "@/types";

interface Row {
  id: string;
  kind: "expense" | "income";
  amount: number | string;
  category_id: string | null;
  category_name: string;
  place: string;
  note: string;
  occurred_on: string;
  occurred_at: string;
  created_at: string;
}
const toTx = (r: Row): Transaction => ({
  id: r.id,
  kind: r.kind,
  amount: typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
  categoryId: r.category_id,
  categoryName: r.category_name,
  place: r.place,
  note: r.note,
  occurredOn: r.occurred_on,
  occurredAt: r.occurred_at ?? r.created_at,
  createdAt: r.created_at,
});

export async function listTransactions(): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toTx);
}

export async function addTransaction(input: NewTransaction): Promise<Transaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      kind: input.kind,
      amount: input.amount,
      category_id: input.categoryId,
      category_name: input.categoryName,
      place: input.place,
      note: input.note,
      occurred_on: input.occurredOn,
      occurred_at: input.occurredAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toTx(data as Row);
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
