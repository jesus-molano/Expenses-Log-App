import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuickExpenseParser } from "./use-quick-expense-parser";

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: online });
}

describe("useQuickExpenseParser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setOnline(true);
  });

  it("uses the local parser right away when offline", async () => {
    setOnline(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() =>
      useQuickExpenseParser({ language: "es", categories: [] }),
    );

    act(() => result.current.setQuickText("Netflix 12,99 el 5 y Spotify 10,99"));
    let parsed: Awaited<ReturnType<typeof result.current.parse>> = null;
    await act(async () => {
      parsed = await result.current.parse();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(parsed).toMatchObject({ provider: "local", reason: "offline" });
    expect(parsed!.drafts).toHaveLength(2);
    expect(result.current.statusLabel).toBe("Sin conexión. Análisis local usado.");
  });

  it("sends today, language and categories and keeps the review hints", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "gemini",
          expenses: [
            { name: "Luz", description: "", amount: 0, categoryName: "Casa", startDate: "2026-10-01", dueDay: 8, recurrence: { frequency: "monthly" } },
          ],
          review: [{ missingFields: ["amount"], inferredFields: [] }],
        }),
      ),
    );
    const { result } = renderHook(() =>
      useQuickExpenseParser({ language: "en", categories: ["Viajes"] }),
    );

    act(() => result.current.setQuickText("Luz el 8"));
    let parsed: Awaited<ReturnType<typeof result.current.parse>> = null;
    await act(async () => {
      parsed = await result.current.parse();
    });

    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({ text: "Luz el 8", language: "en", categories: ["Viajes"] });
    expect(body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed!.drafts[0]).toMatchObject({ missingFields: ["amount"], inferredFields: [] });
    expect(result.current.statusTone).toBe("success");
  });

  it("returns nothing when the user cancels", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const { result } = renderHook(() =>
      useQuickExpenseParser({ language: "es", categories: [] }),
    );

    act(() => result.current.setQuickText("Netflix 12,99"));
    let pending!: ReturnType<typeof result.current.parse>;
    act(() => {
      pending = result.current.parse();
    });
    act(() => result.current.cancel());

    await act(async () => {
      expect(await pending).toBeNull();
    });
    expect(result.current.status).toBe("idle");
  });
});
