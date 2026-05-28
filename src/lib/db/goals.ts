import { createClient } from "@/lib/supabase/client";
import type { Goal, NewGoal } from "@/types";

interface Row {
  id: string;
  title: string;
  target_amount: number | string;
  saved_amount: number | string;
  due_on: string | null;
}
const num = (v: number | string) => (typeof v === "string" ? parseFloat(v) : v);
const toGoal = (r: Row): Goal => ({
  id: r.id,
  title: r.title,
  targetAmount: num(r.target_amount),
  savedAmount: num(r.saved_amount),
  dueOn: r.due_on,
});

export async function listGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toGoal);
}

export async function addGoal(input: NewGoal): Promise<Goal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      title: input.title,
      target_amount: input.targetAmount,
      saved_amount: input.savedAmount,
      due_on: input.dueOn,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toGoal(data as Row);
}

export async function updateGoal(id: string, patch: Partial<NewGoal>): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.targetAmount !== undefined) row.target_amount = patch.targetAmount;
  if (patch.savedAmount !== undefined) row.saved_amount = patch.savedAmount;
  if (patch.dueOn !== undefined) row.due_on = patch.dueOn;
  const { error } = await supabase.from("goals").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
