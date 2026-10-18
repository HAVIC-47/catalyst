import { createClient } from "@/lib/supabase/client";
import type { Challenge, NewChallenge } from "@/types";

interface Row {
  id: string;
  kind: Challenge["kind"];
  target: number | string;
  category_id: string | null;
  category_name: string;
  start_on: string;
  days: number;
  created_at: string;
}
const toChallenge = (r: Row): Challenge => ({
  id: r.id,
  kind: r.kind,
  target: typeof r.target === "string" ? parseFloat(r.target) : r.target,
  categoryId: r.category_id,
  categoryName: r.category_name ?? "",
  startOn: r.start_on,
  days: r.days,
  createdAt: r.created_at,
});

export async function listChallenges(): Promise<Challenge[]> {
  const { data, error } = await createClient().from("challenges").select("*").order("start_on", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toChallenge);
}

export async function addChallenge(c: NewChallenge): Promise<Challenge> {
  const { data, error } = await createClient()
    .from("challenges")
    .insert({ kind: c.kind, target: c.target, category_id: c.categoryId, category_name: c.categoryName, start_on: c.startOn, days: c.days })
    .select("*")
    .single();
  if (error) throw error;
  return toChallenge(data as Row);
}

export async function deleteChallenge(id: string): Promise<void> {
  const { error } = await createClient().from("challenges").delete().eq("id", id);
  if (error) throw error;
}
