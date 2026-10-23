import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { POST } from "./route";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

function parseRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/ai/parse-expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Luz 64,75 mensual dia 8", ...body }),
  });
}

function signedIn() {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: `00000000-0000-4000-8000-${String(Math.random()).slice(2, 14).padEnd(12, "0")}` } },
        error: null,
      }),
    },
  } as never);
}

function geminiReply(json: unknown, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { text: "pensando...", thought: true },
              { text: JSON.stringify(json) },
            ],
          },
        },
      ],
      ...extra,
    }),
    { status: 200 },
  );
}

const luz = {
  name: "Luz",
  amount: 64.75,
  categoryName: "Casa",
  frequency: "monthly",
  interval: null,
  unit: null,
  dueDay: 8,
  annualMonth: null,
  startDate: null,
};

function sentBody(fetchSpy: ReturnType<typeof vi.spyOn>, call = 0) {
  const [, init] = fetchSpy.mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe("/api/ai/parse-expenses", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses the local parser when Gemini is not configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const payload = await (await POST(parseRequest())).json();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(payload).toMatchObject({ provider: "local", reason: "missing_key" });
    expect(payload.expenses[0]).toMatchObject({ amount: 64.75, dueDay: 8 });
    expect(payload.review[0]).toEqual({ missingFields: [], inferredFields: [] });
  });

  it("asks Gemini with a header key, a schema, minimal thinking and today's date", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    signedIn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(geminiReply({ expenses: [luz] }));
    const today = new Date().toISOString().slice(0, 10);

    const payload = await (
      await POST(parseRequest({ today, language: "es", categories: ["Viajes"] }))
    ).json();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    expect(url).not.toContain("key=");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-key" });
    const body = sentBody(fetchSpy);
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "MINIMAL" },
      maxOutputTokens: 1024,
    });
    expect(body.generationConfig).not.toHaveProperty("temperature");
    expect(
      body.generationConfig.responseJsonSchema.properties.expenses.items.properties
        .categoryName.anyOf[0].enum,
    ).toContain("Viajes");
    expect(body.systemInstruction.parts[0].text).toContain(`Hoy es ${today}`);
    expect(payload).toMatchObject({
      provider: "gemini",
      expenses: [{ name: "Luz", amount: 64.75, dueDay: 8, categoryName: "Casa" }],
    });
  });

  it("sends LOW thinking to Flash models that reject MINIMAL", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_MODEL", "gemini-3.8-flash");
    signedIn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(geminiReply({ expenses: [luz] }));

    await POST(parseRequest());

    expect(sentBody(fetchSpy).generationConfig.thinkingConfig).toEqual({
      thinkingLevel: "LOW",
    });
  });

  it("retries without thinking when the model rejects it", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_MODEL", "gemini-3.6-flash");
    signedIn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "thinking_level is not supported" } }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(geminiReply({ expenses: [luz] }));

    const payload = await (await POST(parseRequest())).json();

    expect(payload.provider).toBe("gemini");
    expect(sentBody(fetchSpy, 1).generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("falls back to the second model when the first is retired or out of quota", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    signedIn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(geminiReply({ expenses: [luz] }));

    const payload = await (await POST(parseRequest())).json();

    expect(payload.provider).toBe("gemini");
    expect(fetchSpy.mock.calls[1][0]).toContain("gemini-3.1-flash-lite");
  });

  it("reports quota exhaustion when both models are out of quota", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    signedIn();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "30s" }] },
        }),
        { status: 429 },
      ),
    );

    const payload = await (await POST(parseRequest())).json();

    expect(payload).toMatchObject({ provider: "local", reason: "quota_exhausted" });
    expect(payload.expenses[0]).toMatchObject({ amount: 64.75 });
  });

  it.each([
    [new Response("{}", { status: 401 }), "auth_failed"],
    [new Response("{}", { status: 403 }), "auth_failed"],
    [new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }), "blocked"],
    [
      new Response(
        JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{\"exp" }] } }] }),
        { status: 200 },
      ),
      "truncated",
    ],
    [new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "no json" }] } }] }), { status: 200 }), "invalid_response"],
  ])("falls back to the local parser on %#", async (response, reason) => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    signedIn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(response as Response);

    const payload = await (await POST(parseRequest())).json();

    expect(payload).toMatchObject({ provider: "local", reason });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reports a timeout", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    signedIn();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    const payload = await (await POST(parseRequest())).json();

    expect(payload).toMatchObject({ provider: "local", reason: "timeout" });
  });

  it("keeps the valid expenses of a partial answer and marks missing amounts", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    signedIn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({
        expenses: [
          { ...luz, amount: null, dueDay: "ocho" },
          "basura",
          { ...luz, name: "Gimnasio", amount: 35, categoryName: "Deporte", dueDay: 1 },
        ],
      }),
    );

    const payload = await (await POST(parseRequest())).json();

    expect(payload.droppedCount).toBe(1);
    expect(payload.expenses).toHaveLength(2);
    expect(payload.expenses[0]).toMatchObject({ name: "Luz", amount: 0 });
    expect(payload.review[0].missingFields).toEqual(["amount"]);
    expect(payload.review[0].inferredFields).toContain("dueDay");
  });

  it("uses the local parser for signed-out users", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const payload = await (await POST(parseRequest())).json();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(payload).toMatchObject({ provider: "local", reason: "unauthenticated" });
  });

  it("ignores a client date far from the server date", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    signedIn();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(geminiReply({ expenses: [luz] }));

    await POST(parseRequest({ today: "2020-01-01" }));

    expect(sentBody(fetchSpy).systemInstruction.parts[0].text).not.toContain("2020-01-01");
  });
});
