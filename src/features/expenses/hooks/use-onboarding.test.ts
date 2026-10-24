import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { useOnboarding } from "./use-onboarding";

function mockMatchMedia(standalone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: standalone && query === "(display-mode: standalone)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const withExpense: ExpenseStore = {
  ...emptyStore,
  templates: [{ id: "rent", name: "Alquiler" }] as ExpenseStore["templates"],
};

describe("useOnboarding", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockMatchMedia(false);
    vi.stubGlobal("Notification", { permission: "default" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays visible after the first expense only once the user started there", () => {
    const { result, rerender } = renderHook(
      ({ store }) => useOnboarding({ store, monthId: "2026-10", syncing: false }),
      { initialProps: { store: emptyStore } },
    );
    expect(result.current.visible).toBe(true);
    expect(result.current.checklist.doneCount).toBe(0);

    act(() => result.current.markStarted());
    rerender({ store: withExpense });
    expect(result.current.visible).toBe(true);
    expect(result.current.checklist.steps[0]).toEqual({ id: "expense", done: true });
    expect(result.current.quickAdds.map((preset) => preset.id)).not.toContain("rent");

    // Se recuerda en el dispositivo.
    const again = renderHook(() =>
      useOnboarding({ store: withExpense, monthId: "2026-10", syncing: false }),
    );
    expect(again.result.current.visible).toBe(true);

    act(() => again.result.current.dismiss());
    expect(again.result.current.visible).toBe(false);
    expect(JSON.parse(window.localStorage.getItem("expense-onboarding-v1")!)).toMatchObject({
      startedAt: expect.any(String),
      dismissedAt: expect.any(String),
    });
  });

  it("is not shown to someone whose expenses come from another device", () => {
    const { result } = renderHook(() =>
      useOnboarding({ store: withExpense, monthId: "2026-10", syncing: false }),
    );
    expect(result.current.visible).toBe(false);
  });

  it("reads salary, notifications and installation from the store and the browser", () => {
    mockMatchMedia(true);
    vi.stubGlobal("Notification", { permission: "granted" });
    const store: ExpenseStore = {
      ...withExpense,
      finance: {
        ...emptyStore.finance,
        monthlySalary: { "2026-09": { amount: 2000, dayOfMonth: 28 } },
      },
    };

    const { result } = renderHook(() => useOnboarding({ store, monthId: "2026-10", syncing: false }));

    expect(result.current.checklist.complete).toBe(true);
  });

  it("keeps the browser install prompt to show it from the checklist", async () => {
    const { result } = renderHook(() =>
      useOnboarding({ store: emptyStore, monthId: "2026-10", syncing: false }),
    );
    const prompt = vi.fn(() => Promise.resolve());
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });

    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canPromptInstall).toBe(true);

    await act(() => result.current.promptInstall());
    expect(prompt).toHaveBeenCalledOnce();
    expect(result.current.canPromptInstall).toBe(false);
  });
});
