import { NextResponse } from "next/server";
import {
  parseExpenseTextLocally,
  parseExpensesResponseSchema,
} from "@/domain/parser";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

type LocalFallbackReason =
  | "missing_key"
  | "rate_limited"
  | "quota_exhausted"
  | "ai_unavailable"
  | "invalid_response"
  | "timeout";

const requestBuckets = new Map<string, number[]>();
const GEMINI_REQUESTS_PER_MINUTE = 20;
const GEMINI_TIMEOUT_MS = 8000;

function jsonInstruction(text: string) {
  return `Extract expenses from this Spanish text and return only JSON with this shape: {"expenses":[{"name":"string","description":"string","amount":12.34,"categoryName":"string","startDate":"YYYY-MM-DD","dueDay":1,"recurrence":{"frequency":"once|monthly|quarterly|yearly|custom","interval":1,"unit":"day|week|month|year"}}]}. Use "once" for one-time expenses. Text: ${text}`;
}

function localResponse(text: string, reason: LocalFallbackReason) {
  return NextResponse.json({
    provider: "local",
    reason,
    expenses: parseExpenseTextLocally(text),
  });
}

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function isRateLimited(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (requestBuckets.get(key) ?? []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (recent.length >= GEMINI_REQUESTS_PER_MINUTE) {
    requestBuckets.set(key, recent);
    return true;
  }

  requestBuckets.set(key, [...recent, now]);
  return false;
}

function reasonFromGeminiStatus(status: number): LocalFallbackReason {
  if (status === 429) return "quota_exhausted";
  if (status >= 500) return "ai_unavailable";
  return "invalid_response";
}

function parseJsonPayload(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedRequest = requestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Texto inválido para analizar." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return localResponse(parsedRequest.data.text, "missing_key");
  }

  if (isRateLimited(request)) {
    return localResponse(parsedRequest.data.text, "rate_limited");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const model = process.env.GEMINI_API_MODEL ?? "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: jsonInstruction(parsedRequest.data.text) }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return localResponse(
        parsedRequest.data.text,
        reasonFromGeminiStatus(response.status),
      );
    }

    const payload = await response.json();
    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";
    const aiJson = parseJsonPayload(text);
    if (!aiJson) {
      return localResponse(parsedRequest.data.text, "invalid_response");
    }

    const parsed = parseExpensesResponseSchema.safeParse(aiJson);

    if (!parsed.success) {
      return localResponse(parsedRequest.data.text, "invalid_response");
    }

    return NextResponse.json({ provider: "gemini", expenses: parsed.data.expenses });
  } catch (error) {
    return localResponse(
      parsedRequest.data.text,
      error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : "ai_unavailable",
    );
  } finally {
    clearTimeout(timeout);
  }
}
