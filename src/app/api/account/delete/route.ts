// Deletes the signed-in account for good: the auth user, and with it every row
// they own (each table's user_id cascades on delete). Session cookie on the web,
// Bearer token from the Android app. Needs the service-role key on the server.
//
//   POST { confirm: "DELETE" }
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signedIn } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  // JSON only: a cross-site form can't send it, and a cross-site fetch needs a
  // preflight this route never grants.
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "Send JSON.");
  const session = await signedIn(request);
  if (!session) return fail(401, "Log in again to delete your account.");

  let body: { confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  if (body.confirm !== "DELETE") return fail(400, 'Type DELETE to confirm.');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return fail(503, "Account deletion isn't set up on the server yet (SUPABASE_SERVICE_ROLE_KEY).");

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(session.userId);
  if (error) {
    console.error("[account] delete failed", error.message);
    return fail(502, "Couldn't delete the account just now — try again.");
  }
  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
