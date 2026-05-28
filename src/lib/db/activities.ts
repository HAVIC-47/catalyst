import { createClient } from "@/lib/supabase/client";
import type { Activity, ActivityLog, NewActivity } from "@/types";

interface ARow {
  id: string;
  name: string;
  color: string;
  sort: number;
}
const toActivity = (r: ARow): Activity => ({ id: r.id, name: r.name, color: r.color, sort: r.sort });

interface LRow {
  id: string;
  activity_id: string;
  logged_on: string;
  value: string;
}
const toLog = (r: LRow): ActivityLog => ({
  id: r.id,
  activityId: r.activity_id,
  loggedOn: r.logged_on,
  value: r.value,
});

export async function listActivities(): Promise<Activity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data as ARow[]).map(toActivity);
}

export async function addActivity(input: NewActivity): Promise<Activity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activities")
    .insert({ name: input.name, color: input.color, sort: input.sort })
    .select("*")
    .single();
  if (error) throw error;
  return toActivity(data as ARow);
}

export async function deleteActivity(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw error;
}

export async function listActivityLogs(): Promise<ActivityLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("activity_logs").select("*");
  if (error) throw error;
  return (data as LRow[]).map(toLog);
}

export async function addActivityLog(activityId: string, loggedOn: string): Promise<ActivityLog> {
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("activity_logs")
    .insert({ user_id: u.user?.id, activity_id: activityId, logged_on: loggedOn, value: "done" })
    .select("*")
    .single();
  if (error) throw error;
  return toLog(data as LRow);
}

export async function deleteActivityLog(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("activity_logs").delete().eq("id", id);
  if (error) throw error;
}
