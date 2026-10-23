// Cliente mínimo de Gemini (REST generateContent) para respuestas JSON con
// esquema. Sin SDK: un fetch, autenticación por cabecera y una política de
// reintentos pensada para alguien que espera delante de la pantalla.

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_DEADLINE_MS = 10_000;
const MAX_RETRY_DELAY_MS = 2_000;

export type GeminiFailureReason =
  | "auth_failed"
  | "model_unavailable"
  | "quota_exhausted"
  | "blocked"
  | "truncated"
  | "invalid_response"
  | "timeout"
  | "ai_unavailable";

export type GeminiJsonResult =
  | { ok: true; json: unknown; model: string }
  | { ok: false; reason: GeminiFailureReason };

type GenerateJsonOptions = {
  apiKey: string;
  models: string[];
  systemInstruction: string;
  userText: string;
  schema: unknown;
  deadlineMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
};

type Attempt =
  | { kind: "ok"; json: unknown }
  | { kind: "fail"; reason: GeminiFailureReason; retryAfterMs?: number; thinkingRejected?: boolean };

// Nivel de razonamiento por familia de modelo: los Flash-Lite aceptan MINIMAL;
// los Flash 3.x lo rechazan y van con LOW; 2.5 usa thinkingBudget. A un modelo
// desconocido no se le manda nada.
export function thinkingConfigFor(model: string): Record<string, unknown> | undefined {
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/flash-lite/.test(model)) return { thinkingLevel: "MINIMAL" };
  if (/^gemini-3\.\d+-flash$/.test(model)) return { thinkingLevel: "LOW" };
  return undefined;
}

function defaultWait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelay(body: unknown): number | undefined {
  const details = (body as { error?: { details?: unknown[] } })?.error?.details;
  const retryInfo = details?.find(
    (detail): detail is { retryDelay: string } =>
      typeof (detail as { retryDelay?: unknown })?.retryDelay === "string",
  );
  const seconds = retryInfo ? Number.parseFloat(retryInfo.retryDelay) : NaN;
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
]);

function readCandidate(payload: unknown): Attempt {
  const data = payload as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  if (data?.promptFeedback?.blockReason) return { kind: "fail", reason: "blocked" };
  const candidate = data?.candidates?.[0];
  if (!candidate) return { kind: "fail", reason: "invalid_response" };
  if (candidate.finishReason === "MAX_TOKENS") return { kind: "fail", reason: "truncated" };
  if (candidate.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
    return { kind: "fail", reason: "blocked" };
  }
  const text = (candidate.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
  try {
    return { kind: "ok", json: JSON.parse(text) };
  } catch {
    return { kind: "fail", reason: "invalid_response" };
  }
}

async function attempt(
  options: GenerateJsonOptions,
  model: string,
  withThinking: boolean,
  remainingMs: number,
): Promise<Attempt> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const thinkingConfig = withThinking ? thinkingConfigFor(model) : undefined;
  let response: Response;
  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": options.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: options.userText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: options.schema,
            maxOutputTokens: 1024,
            ...(thinkingConfig ? { thinkingConfig } : {}),
          },
        }),
        signal: AbortSignal.timeout(Math.max(remainingMs, 1)),
      },
    );
  } catch (error) {
    const name = (error as { name?: string })?.name;
    return {
      kind: "fail",
      reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "ai_unavailable",
    };
  }

  if (response.ok) {
    const payload = await response.json().catch(() => null);
    return readCandidate(payload);
  }

  const body = await response.json().catch(() => null);
  const message = JSON.stringify(body ?? "").toLowerCase();
  if (response.status === 400 && withThinking && thinkingConfig && message.includes("thinking")) {
    return { kind: "fail", reason: "invalid_response", thinkingRejected: true };
  }
  // Una clave inválida o caducada llega como 400 (API_KEY_INVALID/EXPIRED).
  if (
    response.status === 401 ||
    response.status === 403 ||
    (response.status === 400 && (message.includes("api_key_") || message.includes("api key")))
  ) {
    return { kind: "fail", reason: "auth_failed" };
  }
  if (response.status === 404) return { kind: "fail", reason: "model_unavailable" };
  if (response.status === 429) {
    return { kind: "fail", reason: "quota_exhausted", retryAfterMs: parseRetryDelay(body) };
  }
  if (response.status >= 500) return { kind: "fail", reason: "ai_unavailable" };
  return { kind: "fail", reason: "invalid_response" };
}

function logFailure(model: string, reason: GeminiFailureReason) {
  // Sin el texto del usuario: solo modelo y motivo.
  console.error(JSON.stringify({ event: "gemini_failure", model, reason }));
}

// Prueba el modelo principal y, si no está disponible, sin cuota o caído, el
// de respaldo, todo dentro de un mismo plazo. Un error de clave o de petición
// no se reintenta.
export async function generateJson(options: GenerateJsonOptions): Promise<GeminiJsonResult> {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? defaultWait;
  const deadline = now() + (options.deadlineMs ?? GEMINI_DEADLINE_MS);
  const models = Array.from(new Set(options.models.filter(Boolean)));
  let lastReason: GeminiFailureReason = "ai_unavailable";

  for (const model of models) {
    let withThinking = true;
    let retried = false;
    while (true) {
      const remaining = deadline - now();
      if (remaining <= 0) return { ok: false, reason: "timeout" };
      const result = await attempt(options, model, withThinking, remaining);
      if (result.kind === "ok") return { ok: true, json: result.json, model };

      lastReason = result.reason;
      logFailure(model, result.reason);
      if (result.thinkingRejected) {
        withThinking = false;
        continue;
      }
      if (["auth_failed", "invalid_response", "blocked", "truncated", "timeout"].includes(result.reason)) {
        return { ok: false, reason: result.reason };
      }
      // Un reintento corto si cabe en el plazo; si no, el siguiente modelo.
      const retryDelay =
        result.reason === "quota_exhausted"
          ? result.retryAfterMs
          : result.reason === "ai_unavailable"
            ? 200 + Math.floor(Math.random() * 400)
            : undefined;
      if (
        !retried &&
        retryDelay !== undefined &&
        retryDelay <= MAX_RETRY_DELAY_MS &&
        now() + retryDelay < deadline
      ) {
        retried = true;
        await wait(retryDelay);
        continue;
      }
      break;
    }
  }

  return { ok: false, reason: lastReason };
}
