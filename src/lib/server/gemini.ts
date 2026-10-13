// Asks Gemini for JSON that follows a schema. Shared by the memo scanner and the
// AI summaries. GEMINI_API_KEY is read only here, on the server.

// Tried in order: when Google answers "busy" (429/5xx) or a model is retired, the
// next one gets the request. Override with GEMINI_MODELS="model[:thinkingLevel],…".
const MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash:low,gemini-3.1-flash-lite,gemini-3.5-flash-lite")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [model, thinking] = s.split(":");
    return { model, thinking };
  });

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type GeminiResult =
  | { ok: true; json: Record<string, unknown> }
  // busy: every model was rate-limited, overloaded or timed out — worth retrying soon.
  // unavailable: no model could be reached. failed: a model answered, but not usably.
  | { ok: false; reason: "busy" | "unavailable" | "failed" };

export async function geminiJson({
  key,
  system,
  parts,
  schema,
  temperature = 0,
  tag,
}: {
  key: string;
  system: string;
  parts: GeminiPart[];
  schema: Record<string, unknown>;
  temperature?: number;
  tag: string; // log prefix, e.g. "scan-memo"
}): Promise<GeminiResult> {
  const body = (thinking?: string) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
        responseSchema: schema,
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      },
    });

  // Stay inside the routes' 60 s maxDuration.
  const deadline = Date.now() + 52_000;
  let busy = false;
  for (const { model, thinking } of MODELS) {
    const left = deadline - Date.now();
    if (left < 4_000) break;
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: body(thinking),
        signal: AbortSignal.timeout(Math.min(30_000, left)),
      });
    } catch {
      busy = true; // timed out or network error: try the next model
      continue;
    }
    if (!res.ok) {
      // Busy, rate-limited, retired or not available to this key: next model.
      if ([404, 429, 500, 502, 503, 504].includes(res.status)) {
        busy ||= res.status !== 404;
        continue;
      }
      console.error(`[${tag}] gemini`, model, res.status, (await res.text()).slice(0, 300));
      return { ok: false, reason: "failed" };
    }

    const data = await res.json().catch(() => null);
    const out: string | undefined = data?.candidates?.[0]?.content?.parts?.find(
      (p: { text?: string; thought?: boolean }) => typeof p.text === "string" && !p.thought,
    )?.text;
    try {
      const json = out ? JSON.parse(out) : null;
      if (json && typeof json === "object" && !Array.isArray(json)) return { ok: true, json };
    } catch {
      /* fall through */
    }
    return { ok: false, reason: "failed" };
  }
  return { ok: false, reason: busy ? "busy" : "unavailable" };
}
