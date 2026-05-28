import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  type Category,
  type NewCategory,
} from "@/types";

interface Row {
  id: string;
  name: string;
  kind: "expense" | "income";
  color: string;
  sort: number;
}
const toCategory = (r: Row): Category => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  color: r.color,
  sort: r.sort,
});

export async function listCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("kind", { ascending: true })
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toCategory);
}

export async function addCategory(input: NewCategory): Promise<Category> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: input.name, kind: input.kind, color: input.color, sort: input.sort })
    .select("*")
    .single();
  if (error) throw error;
  return toCategory(data as Row);
}

export async function updateCategory(id: string, patch: Partial<NewCategory>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

/** Seed the default category set for a brand-new user (only when they have none). */
export async function seedDefaultCategories(): Promise<Category[]> {
  const supabase = createClient();
  const rows = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
      name: c.name,
      kind: "expense" as const,
      color: c.color,
      sort: i,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
      name: c.name,
      kind: "income" as const,
      color: c.color,
      sort: i,
    })),
  ];
  const { data, error } = await supabase.from("categories").insert(rows).select("*");
  if (error) throw error;
  return (data as Row[]).map(toCategory);
}
