// Server-side Supabase client for Server Components / Route Handlers.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { REMEMBER_COOKIE, remembered, withLifetime } from "@/lib/supabase/remember";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // "Remember me" off: session cookies, gone when the browser closes.
          const remember = remembered(cookieStore.get(REMEMBER_COOKIE)?.value);
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, withLifetime(options, remember)),
          );
        } catch {
          // Called from a Server Component — safe to ignore; the proxy refreshes the session.
        }
      },
    },
  });
}
