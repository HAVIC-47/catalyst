// Asks Gemini for JSON that follows a schema. Shared by the memo and list
// scanners and the AI summaries. GEMINI_API_KEY is read only here, on the server.

// In order of preference. When Google answers "busy" (429/5xx), a model is retired
// or turns the request down, the next one gets it — and a model that's slow to
// answer gets company: after `hedgeAfterMs` the next one is asked too, and the
// first usable answer wins. Override with GEMINI_MODELS="model[:thinkingLevel],…".
// (gemini-3.5-flash, first here until 1.6.1, is deprecated: Google routes it to
// 3.6 Flash, and scans got slow.)
const MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.8-flash:low,gemini-3.5-flash-lite,gemini-3.6-flash:low,gemini-3.1-flash-lite")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [model, thinking] = s.split(":");
    return { model, thinking };
  });

// Gemini 3 and later are tuned for their default temperature: Google advises
// leaving it alone, as a lower one can make the model loop (slow, worse answers).
const TUNED_TEMPERATURE = /^gemini-(?:[3-9]|\d{2,})\b/;

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * The schema as Gemini accepts it. Gemini refuses a whole request when a list of
 * allowed values (enum) holds an empty string ("enum[7]: cannot be empty"), and
 * some lists come from the user's data (category names), so empty and repeated
 * values are dropped — and a list left empty, so the field is free text.
 */
export function cleanSchema<T>(schema: T): T {
  if (Array.isArray(schema)) return schema.map(cleanSchema) as T;
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "enum" && Array.isArray(v)) {
      const values = [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim() !== ""))];
      if (values.length) out.enum = values;
    } else {
      out[k] = cleanSchema(v);
    }
  }
  return out as T;
}

export type GeminiResult =
  | { ok: true; json: Record<string, unknown> }
  // busy: every model was rate-limited, overloaded or timed out — worth retrying soon.
  // unavailable: no model could be reached. failed: models answered, but not usably.
  | { ok: false; reason: "busy" | "unavailable" | "failed" };

type Attempt = { ok: true; json: Record<string, unknown> } | { ok: false; busy: boolean; refused: boolean };

/** One model's answer: its JSON, or why not. */
async function attempt(model: string, body: string, key: string, signal: AbortSignal, tag: string): Promise<Attempt> {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
      signal,
    });
  } catch {
    return { ok: false, busy: true, refused: false }; // timed out, or the network
  }
  if (!res.ok) {
    // 429/5xx: busy. 404: retired or not open to this key. 400/401/403: this model
    // turned the request down (a setting it doesn't take, or the key).
    const busy = [429, 500, 502, 503, 504].includes(res.status);
    if (!busy && res.status !== 404) console.error(`[${tag}] gemini`, model, res.status, (await res.text().catch(() => "")).slice(0, 300));
    return { ok: false, busy, refused: [400, 401, 403].includes(res.status) };
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
  console.error(`[${tag}] gemini`, model, "answered without usable JSON", data?.candidates?.[0]?.finishReason ?? "");
  return { ok: false, busy: false, refused: true };
}

export async function geminiJson({
  key,
  system,
  parts,
  schema,
  temperature,
  hedgeAfterMs = Number(process.env.GEMINI_HEDGE_MS) || 12_000,
  tag,
}: {
  key: string;
  system: string;
  parts: GeminiPart[];
  schema: Record<string, unknown>;
  temperature?: number; // only for models before Gemini 3
  hedgeAfterMs?: number; // a model this slow to answer gets the next one asked too
  tag: string; // log prefix, e.g. "scan-memo"
}): Promise<GeminiResult> {
  const responseSchema = cleanSchema(schema);
  const body = (model: string, thinking?: string) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        ...(temperature !== undefined && !TUNED_TEMPERATURE.test(model) ? { temperature } : {}),
        responseMimeType: "application/json",
        responseSchema,
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      },
    });

  const started = Date.now();
  const deadline = started + 52_000; // inside the routes' 60 s maxDuration
  return new Promise<GeminiResult>((resolve) => {
    const running = new Set<AbortController>();
    let next = 0;
    let busy = false;
    let refused = false;
    let done = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: GeminiResult) => {
      if (done) return;
      done = true;
      clearTimeout(hedge);
      for (const c of running) c.abort(); // the others' answers aren't needed
      resolve(result);
    };

    // Ask the next model: now when the last one is out, or alongside a slow one.
    const launch = () => {
      if (done) return;
      clearTimeout(hedge);
      const left = deadline - Date.now();
      if (next >= MODELS.length || left < 4_000) {
        if (!running.size) finish({ ok: false, reason: refused ? "failed" : busy ? "busy" : "unavailable" });
        return;
      }
      const { model, thinking } = MODELS[next++];
      const ctrl = new AbortController();
      running.add(ctrl);
      const timeout = setTimeout(() => ctrl.abort(), Math.min(30_000, left));
      hedge = setTimeout(launch, hedgeAfterMs);
      const asked = Date.now();
      void attempt(model, body(model, thinking), key, ctrl.signal, tag).then((r) => {
        clearTimeout(timeout);
        running.delete(ctrl);
        if (done) return;
        if (r.ok) {
          console.info(`[${tag}] ${model} answered in ${Date.now() - asked} ms (${Date.now() - started} ms in all)`);
          finish({ ok: true, json: r.json });
          return;
        }
        busy ||= r.busy;
        refused ||= r.refused;
        launch();
      });
    };
    launch();
  });
}
