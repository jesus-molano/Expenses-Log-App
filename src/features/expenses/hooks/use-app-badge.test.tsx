import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { useAppBadge } from "./use-app-badge";

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    {
      id: "exp-rent",
      userId: "user",
      name: "Alquiler",
      description: "",
      amount: 700,
      currency: "EUR",
      categoryId: "home",
      startDate: "2026-10-01",
      dueDay: 1,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
};

afterEach(() => {
  Reflect.deleteProperty(navigator, "setAppBadge");
  Reflect.deleteProperty(navigator, "clearAppBadge");
});

function stubBadging() {
  const setAppBadge = vi.fn().mockResolvedValue(undefined);
  const clearAppBadge = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "setAppBadge", { configurable: true, value: setAppBadge });
  Object.defineProperty(navigator, "clearAppBadge", { configurable: true, value: clearAppBadge });
  return { setAppBadge, clearAppBadge };
}

describe("useAppBadge", () => {
  it("shows overdue and today's charges on the app icon", async () => {
    const { setAppBadge } = stubBadging();

    const { result } = renderHook(() => useAppBadge(store, new Date("2026-10-23T10:00:00")));

    expect(result.current).toBe(1);
    await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(1));
  });

  it("clears the badge when nothing needs attention", async () => {
    const { clearAppBadge } = stubBadging();

    renderHook(() => useAppBadge(emptyStore, new Date("2026-10-23T10:00:00")));

    await waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
  });

  it("does nothing without the Badging API", () => {
    const { result } = renderHook(() => useAppBadge(store, new Date("2026-10-23T10:00:00")));
    expect(result.current).toBe(1);
  });
});
