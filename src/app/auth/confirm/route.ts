// Email links in the token-hash style (Supabase → Email Templates):
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset
// They work in any browser or device, unlike code links. Verifies the token,
// signs the user in and continues to ?next=.
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth-redirect";

const TYPES: EmailOtpType[] = ["recovery", "signup", "email", "email_change", "invite", "magiclink"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = TYPES.find((t) => t === url.searchParams.get("type"));
  const next = safeNext(url.searchParams.get("next") ?? (type === "recovery" ? "/reset" : "/app"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth] token verification failed", error.message);
  }
  const back = new URL(type === "recovery" ? "/forgot" : "/login", url.origin);
  if (type !== "recovery") back.searchParams.set("from", "landing");
  back.searchParams.set("error", "That link didn't work — it may have expired. Ask for a new one.");
  return NextResponse.redirect(back);
}
