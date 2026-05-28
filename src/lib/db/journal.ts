import { createClient } from "@/lib/supabase/client";
import type { JournalEntry, NewJournalEntry } from "@/types";

interface Row {
  id: string;
  entry_on: string;
  mood: number | null;
  title: string;
  body: string;
  created_at: string;
}
const toEntry = (r: Row): JournalEntry => ({
  id: r.id,
  entryOn: r.entry_on,
  mood: r.mood,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
});

export async function listJournal(): Promise<JournalEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toEntry);
}

export async function addJournal(input: NewJournalEntry): Promise<JournalEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      entry_on: input.entryOn,
      mood: input.mood,
      title: input.title,
      body: input.body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toEntry(data as Row);
}

export async function deleteJournal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw error;
}
