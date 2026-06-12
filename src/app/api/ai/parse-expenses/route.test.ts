import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function parseRequest(text = "Luz 64,75 mensual dia 8") {
  return new Request("http://localhost/api/ai/parse-expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

describe("/api/ai/parse-expenses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses the local parser when Gemini is not configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(parseRequest());
    const payload = await response.json();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      provider: "local",
      reason: "missing_key",
    });
    expect(payload.expenses[0]).toMatchObject({
      amount: 64.75,
      dueDay: 8,
    });
  });

  it("reports quota exhaustion without failing the expense flow", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 429 }),
    );

    const response = await POST(parseRequest());
    const payload = await response.json();

    expect(payload).toMatchObject({
      provider: "local",
      reason: "quota_exhausted",
    });
    expect(payload.expenses[0].name).toBeTruthy();
  });

  it("falls back locally when Gemini returns invalid JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: "not json" }] } }],
      }),
    );

    const response = await POST(parseRequest());
    const payload = await response.json();

    expect(payload).toMatchObject({
      provider: "local",
      reason: "invalid_response",
    });
  });
});
