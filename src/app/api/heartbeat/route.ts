// Keep-alive endpoint. Makes one cheap round-trip to Supabase so the project
// registers activity, then answers 204 with no body. Nothing here touches user
// data: the query is RLS-scoped like every other read, so an anonymous ping
// simply comes back empty.
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createClient();
    await supabase.from("categories").select("id", { head: true, count: "exact" }).limit(1);
  } catch {
    // A failed ping is not worth surfacing — the next hour tries again.
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
