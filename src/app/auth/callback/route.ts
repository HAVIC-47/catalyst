// Where Supabase sends the browser back after Google sign-in or an email link
// (password reset): swaps the one-time code for a session cookie, then continues
// to ?next= (a path on this site only).
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth-redirect";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const failed = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth] code exchange failed", error.message);
  }
  // A reset link opened in another browser can't use the code — ask for a fresh one.
  const back = new URL(next === "/reset" ? "/forgot" : "/login", url.origin);
  if (next !== "/reset") back.searchParams.set("from", "landing");
  back.searchParams.set("error", failed ?? "That link didn't work — it may have expired or been opened in another browser.");
  return NextResponse.redirect(back);
}
