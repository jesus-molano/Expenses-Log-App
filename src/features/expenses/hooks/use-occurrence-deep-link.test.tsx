import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { occurrencesDueBetween } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { useOccurrenceDeepLink } from "./use-occurrence-deep-link";

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
      startDate: "2026-09-01",
      dueDay: 1,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  ],
};

const october = occurrencesDueBetween(store, "2026-10-01", "2026-10-31");
const november = occurrencesDueBetween(store, "2026-11-01", "2026-11-30");

function addRow(id: string) {
  const row = document.createElement("div");
  row.dataset.expenseRowId = id;
  row.tabIndex = 0;
  document.body.appendChild(row);
  return row;
}

function render(overrides: Partial<Parameters<typeof useOccurrenceDeepLink>[0]> = {}) {
  const options = {
    store,
    language: "es" as const,
    activeMonthId: "2026-10",
    viewMonthId: "2026-10",
    visibleOccurrences: october,
    showMonth: vi.fn(),
    onMissing: vi.fn(),
    ...overrides,
  };
  const hook = renderHook((props: typeof options) => useOccurrenceDeepLink(props), {
    initialProps: options,
  });
  return { ...hook, options };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("useOccurrenceDeepLink", () => {
  it("highlights a listed occurrence and cleans the URL", () => {
    window.history.replaceState({ layer: 1 }, "", "/?occurrence=exp-rent%3A2026-10-01");
    const row = addRow("exp-rent:2026-10-01");

    const { result, options } = render();
    vi.advanceTimersToNextFrame();

    expect(result.current.openedFromLink).toBe(true);
    expect(row.dataset.highlighted).toBe("true");
    expect(document.activeElement).toBe(row);
    expect(window.location.search).toBe("");
    // El estado de las capas del historial se conserva.
    expect(window.history.state).toEqual({ layer: 1 });
    expect(options.showMonth).not.toHaveBeenCalled();

    vi.advanceTimersByTime(4_000);
    expect(row.dataset.highlighted).toBeUndefined();
  });

  it("moves to the month where the occurrence is listed", () => {
    window.history.replaceState(null, "", "/?occurrence=exp-rent%3A2026-11-01");
    const row = addRow("exp-rent:2026-11-01");

    const { options, rerender } = render();
    expect(options.showMonth).toHaveBeenCalledWith("2026-11");

    rerender({ ...options, viewMonthId: "2026-11", visibleOccurrences: november });
    vi.advanceTimersToNextFrame();

    expect(row.dataset.highlighted).toBe("true");
    expect(options.onMissing).not.toHaveBeenCalled();
  });

  it("says so when the occurrence no longer exists", () => {
    window.history.replaceState(null, "", "/?occurrence=exp-gone%3A2026-10-01");

    const { result, options } = render();

    expect(options.onMissing).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
    expect(result.current.openedFromLink).toBe(true);
  });

  it("does nothing without a link", () => {
    const { result, options } = render();

    expect(result.current.openedFromLink).toBe(false);
    expect(options.onMissing).not.toHaveBeenCalled();
    expect(options.showMonth).not.toHaveBeenCalled();
  });
});
