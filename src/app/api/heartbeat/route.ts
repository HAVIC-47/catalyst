// Keep-alive endpoint. Calls keepalive_ping(), which writes a timestamp to the
// single-row public.keepalive table (see db/keepalive.sql) so the Supabase project
// registers real database activity, then answers 204 with no body. Touches no user
// data — the function can only bump that one row.
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createClient();
    await supabase.rpc("keepalive_ping");
  } catch {
    // A failed ping is not worth surfacing — the next hour tries again.
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
