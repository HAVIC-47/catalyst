// Erases everything the signed-in account has recorded — entries, moods, wallets,
// bills, boards, journal… — but keeps the account itself (login and settings), so
// it can start fresh. Runs as the user (session cookie on the web, Bearer token
// from the Android app): row-level security limits every delete to their own rows.
// The daily-limit counters (memo_scans, ai_requests) can't be deleted by users and
// hold no content, so they stay.
//
//   POST { confirm: "ERASE" }
import { NextResponse, type NextRequest } from "next/server";
import { signedIn } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// Children before parents, so nothing waits on a cascade. Tables that don't exist
// yet (a database without the latest update) are skipped.
const TABLES = [
  "transactions",
  "recurring",
  "challenges",
  "bills",
  "budgets",
  "goals",
  "debt_payments",
  "debts",
  "transfers",
  "wallets",
  "categories",
  "mood_logs",
  "journal_entries",
  "activity_logs",
  "activities",
  "tickets",
  "board_columns",
  "boards",
  "ai_insights",
];

export async function POST(request: NextRequest) {
  // JSON only: a cross-site form can't send it, and a cross-site fetch needs a
  // preflight this route never grants.
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "Send JSON.");
  const session = await signedIn(request);
  if (!session) return fail(401, "Log in again to erase your data.");

  let body: { confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  if (body.confirm !== "ERASE") return fail(400, "Type ERASE to confirm.");

  const { supabase, userId } = session;
  const erased: string[] = [];
  for (const table of TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (!error) {
      erased.push(table);
      continue;
    }
    if (error.code === "PGRST205" || error.code === "42P01" || /does not exist|schema cache/i.test(error.message)) continue;
    console.error("[account] erase failed at", table, error.message);
    return fail(502, "Couldn't erase everything just now — try again.");
  }
  return NextResponse.json({ erased }, { headers: { "Cache-Control": "no-store" } });
}
