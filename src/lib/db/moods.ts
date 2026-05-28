import { createClient } from "@/lib/supabase/client";
import type { MoodLog, NewMoodLog } from "@/types";

interface Row {
  id: string;
  mood: number;
  note: string;
  tags: string[] | null;
  logged_on: string;
  logged_at: string;
  created_at: string;
}
const toMood = (r: Row): MoodLog => ({
  id: r.id,
  mood: r.mood,
  note: r.note,
  tags: r.tags ?? [],
  loggedOn: r.logged_on,
  loggedAt: r.logged_at ?? r.created_at,
  createdAt: r.created_at,
});

export async function listMoods(): Promise<MoodLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mood_logs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toMood);
}

/** Multiple moods per day allowed — each save is a new timestamped log. */
export async function addMood(input: NewMoodLog): Promise<MoodLog> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mood_logs")
    .insert({
      mood: input.mood,
      note: input.note,
      tags: input.tags,
      logged_on: input.loggedOn,
      logged_at: input.loggedAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toMood(data as Row);
}

export async function deleteMood(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("mood_logs").delete().eq("id", id);
  if (error) throw error;
}
