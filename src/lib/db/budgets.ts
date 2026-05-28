import { createClient } from "@/lib/supabase/client";
import type { Budget, NewBudget } from "@/types";

interface Row {
  id: string;
  category_id: string | null;
  category_name: string;
  amount: number | string;
  period: string;
}
const toBudget = (r: Row): Budget => ({
  id: r.id,
  categoryId: r.category_id,
  categoryName: r.category_name,
  amount: typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
  period: r.period,
});

export async function listBudgets(): Promise<Budget[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("budgets").select("*");
  if (error) throw error;
  return (data as Row[]).map(toBudget);
}

export async function addBudget(input: NewBudget): Promise<Budget> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      category_id: input.categoryId,
      category_name: input.categoryName,
      amount: input.amount,
      period: input.period,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toBudget(data as Row);
}

export async function updateBudget(id: string, patch: Partial<NewBudget>): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.categoryName !== undefined) row.category_name = patch.categoryName;
  if (patch.period !== undefined) row.period = patch.period;
  const { error } = await supabase.from("budgets").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteBudget(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
}
