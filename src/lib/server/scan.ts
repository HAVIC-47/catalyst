// Shared by the photo readers (/api/scan-memo, /api/scan-list): what a photo
// request must carry, and the per-account daily cap on photos read with the
// server's Gemini key (public.memo_scans — one row per photo, no content).
import type { SupabaseClient } from "@supabase/supabase-js";

export const DAILY_SCANS = 40;
const MAX_BASE64 = 4_000_000; // ~3 MB image; clients resize to ~1600px first, well under this
const MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export type Failure = { status: number; error: string };

/** The photo from a request body, or why it can't be read. */
export function readImage(body: { image?: unknown; mimeType?: unknown }): { image: string; mimeType: string } | Failure {
  const image = typeof body.image === "string" ? body.image : "";
  const mimeType = typeof body.mimeType === "string" && MIME.has(body.mimeType) ? body.mimeType : "";
  if (!image || !mimeType) return { status: 400, error: "Send a JPEG, PNG or WebP photo." };
  if (image.length > MAX_BASE64) return { status: 413, error: "That photo is too large — try again with a smaller one." };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return { status: 400, error: "Bad image data." };
  return { image, mimeType };
}

/** The user's local date (their phone/browser), else Bangladesh time. */
export function localToday(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? v
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

/**
 * Counts one photo toward today's limit; null when it may be read. Rows can be
 * added but never deleted by the user, so the count can't be reset from the client.
 */
export async function countScan(supabase: SupabaseClient, tag: string): Promise<Failure | null> {
  const notSetUp = { status: 503, error: "Scanning isn't set up yet — run db/supabase.sql in Supabase." };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error } = await supabase
    .from("memo_scans")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) {
    console.error(`[${tag}] memo_scans unavailable`, error.code, error.message);
    return notSetUp;
  }
  if ((count ?? 0) >= DAILY_SCANS) return { status: 429, error: `You've scanned ${DAILY_SCANS} photos today — try again tomorrow.` };
  const { error: logError } = await supabase.from("memo_scans").insert({});
  if (logError) {
    console.error(`[${tag}] could not record scan`, logError.code, logError.message);
    return notSetUp;
  }
  return null;
}
