// Who is calling an API route. The web app sends its session cookie, the Android
// app `Authorization: Bearer <supabase access token>`. Either way the returned
// client acts as that user, so every query stays RLS-scoped to their own rows.
import type { NextRequest } from "next/server";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface Session {
  supabase: SupabaseClient;
  userId: string;
  /** The account's preferences (currency, language…) — never use for authorization. */
  meta: Record<string, unknown>;
}

export async function signedIn(request: NextRequest): Promise<Session | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase.auth.getUser(bearer);
    return data.user ? { supabase, userId: data.user.id, meta: data.user.user_metadata ?? {} } : null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id, meta: data.user.user_metadata ?? {} } : null;
}
