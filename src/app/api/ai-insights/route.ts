// AI summaries + suggestions for one topic (journal, ledger, goals, savings, bills,
// mood, the boards, or the whole-period recap) and one period (a week, month or
// year), written in the account's currency and the app's language. The server reads the user's own
// rows — as that user, so RLS still applies — and boils them down to a digest
// (src/lib/server/insights.ts) that Gemini writes the summary from. The client
// never sends free text to the model, so the key can't be used for anything else.
//
//   POST { topic, period, start: "yyyy-mm-dd", today, mode, lang?: "en" | "bn" }
//   mode "cached":   the saved summary for that period, if any, and whether newer
//                    data has been logged since. No AI call.
//   mode "generate": a fresh summary (counts toward a daily limit), saved to
//                    public.ai_insights so the web and the app both show it.
//
// Same sign-in as /api/scan-memo: session cookie on the web, Bearer token from
// the Android app.
import { NextResponse, type NextRequest } from "next/server";
import { currencyOf } from "@/lib/currency";
import { INSIGHT_PERIODS, INSIGHT_TOPICS, type InsightLang, type InsightPeriod, type InsightResponse, type InsightTopic } from "@/lib/insights";
import { geminiJson } from "@/lib/server/gemini";
import { INSIGHT_SCHEMA, buildDigest, cleanInsight, insightWindow, systemPrompt, userPrompt } from "@/lib/server/insights";
import { signedIn } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_SUMMARIES = 60;

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const ok = (body: InsightResponse) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });

const NOT_SET_UP = "AI summaries aren't set up yet — run db/supabase.sql in Supabase.";

export async function POST(request: NextRequest) {
  // JSON only: a cross-site form can't send this content type, and a cross-site
  // fetch with it needs a CORS preflight this route never grants.
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "Send JSON.");

  const session = await signedIn(request);
  if (!session) return fail(401, "Log in to use AI summaries.");
  const { supabase, userId, meta } = session;
  // Amounts in the account's currency; the summary in the language the app shows.
  const currency = currencyOf(meta.currency);

  let body: { topic?: unknown; period?: unknown; start?: unknown; today?: unknown; mode?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const topic = INSIGHT_TOPICS.find((t) => t === body.topic) as InsightTopic | undefined;
  const period = INSIGHT_PERIODS.find((p) => p === body.period) as InsightPeriod | undefined;
  const mode = body.mode === "generate" ? "generate" : "cached";
  const lang: InsightLang = body.lang === "bn" || (body.lang === undefined && meta.lang === "bn") ? "bn" : "en";
  const window = topic && period && typeof body.start === "string" ? insightWindow(period, body.start) : null;
  if (!topic || !period || !window) return fail(400, "Unknown topic or period.");
  // The user's local date (their phone/browser), else Bangladesh time.
  const today =
    typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  const key = process.env.GEMINI_API_KEY;
  if (mode === "generate" && !key) return fail(503, "AI summaries aren't configured on the server (GEMINI_API_KEY).");

  let digest: Awaited<ReturnType<typeof buildDigest>>;
  try {
    digest = await buildDigest(supabase, topic, window, today, currency);
  } catch (err) {
    console.error("[ai-insights] could not read data", topic, err);
    return fail(503, "Couldn't read your data just now — try again.");
  }

  const { data: saved, error: savedError } = await supabase
    .from("ai_insights")
    .select("content,data_hash,created_at")
    .eq("topic", topic)
    .eq("period", period)
    .eq("start_on", window.start)
    .maybeSingle();
  if (savedError) {
    console.error("[ai-insights] ai_insights unavailable", savedError.code, savedError.message);
    return fail(503, NOT_SET_UP);
  }

  if (mode === "cached") {
    const insight = saved ? cleanInsight(saved.content) : null;
    return ok({
      insight,
      generatedAt: insight ? (saved?.created_at ?? null) : null,
      stale: !!insight && saved?.data_hash !== digest.hash,
      empty: digest.empty,
    });
  }

  if (digest.empty) return fail(422, "Nothing's been logged for this period yet.");

  // Per-user daily limit. Rows can be added but never deleted by the user, so the
  // count can't be reset from the client.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (countError) {
    console.error("[ai-insights] ai_requests unavailable", countError.code, countError.message);
    return fail(503, NOT_SET_UP);
  }
  if ((count ?? 0) >= DAILY_SUMMARIES) {
    return fail(429, `You've made ${DAILY_SUMMARIES} AI summaries today — try again tomorrow.`);
  }
  const { error: logError } = await supabase.from("ai_requests").insert({ topic });
  if (logError) {
    console.error("[ai-insights] could not record request", logError.code, logError.message);
    return fail(503, NOT_SET_UP);
  }

  const result = await geminiJson({
    key: key!,
    system: systemPrompt(topic, { currency, lang }),
    parts: [{ text: userPrompt(digest.facts) }],
    schema: INSIGHT_SCHEMA,
    temperature: 0.4, // older models only: Gemini 3 keeps its own
    hedgeAfterMs: 25_000, // a summary takes longer to write than a memo to read
    tag: "ai-insights",
  });
  const insight = result.ok ? cleanInsight(result.json) : null;
  if (!insight) {
    return !result.ok && result.reason === "busy"
      ? fail(503, "The AI is busy right now — try again in a minute.")
      : fail(502, "Couldn't write a summary right now — try again later.");
  }

  const generatedAt = new Date().toISOString();
  const { error: saveError } = await supabase.from("ai_insights").upsert(
    {
      user_id: userId,
      topic,
      period,
      start_on: window.start,
      data_hash: digest.hash,
      content: insight,
      created_at: generatedAt,
    },
    { onConflict: "user_id,topic,period,start_on" },
  );
  // Still worth showing even if it couldn't be saved for next time.
  if (saveError) console.error("[ai-insights] could not save", saveError.code, saveError.message);

  return ok({ insight, generatedAt, stale: false, empty: false });
}
