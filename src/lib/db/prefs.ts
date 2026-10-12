import { createClient } from "@/lib/supabase/client";

// UI preferences live in the auth user's metadata: per account, synced across
// devices, and no table/migration needed. Never use these for authorization —
// users can write their own metadata.

export async function loadPrefs(): Promise<Record<string, unknown>> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.user_metadata ?? {};
}

/** Shallow-merges `patch` into the stored preferences. */
export async function savePrefs(patch: Record<string, unknown>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ data: patch });
  if (error) throw error;
}
