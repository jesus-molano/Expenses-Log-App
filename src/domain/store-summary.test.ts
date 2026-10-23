import { describe, expect, it } from "vitest";
import { emptyStore } from "./seed";
import { hasUserData, summarizeStore } from "./store-summary";
import type { ExpenseOccurrenceRecord, ExpenseStore } from "./types";

function record(
  templateId: string,
  occurrenceDate: string,
  status: ExpenseOccurrenceRecord["status"],
): ExpenseOccurrenceRecord {
  return {
    id: `record:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    monthId: occurrenceDate.slice(0, 7),
    dueDate: occurrenceDate,
    name: templateId,
    description: "",
    plannedAmount: 10,
    currency: "EUR",
    categoryId: "cat",
    categoryName: "General",
    status,
    sortOrder: 0,
    source: "native",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("store summary", () => {
  it("counts each paid occurrence once, whether it lives in an override or the history", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [],
      overrides: [
        { id: "a", userId: "demo", templateId: "rent", occurrenceDate: "2026-09-01", status: "paid" },
        { id: "b", userId: "demo", templateId: "rent", occurrenceDate: "2026-10-01", status: "due" },
      ],
      occurrenceRecords: [
        record("rent", "2026-09-01", "paid"),
        record("gym", "2026-09-12", "paid"),
        record("gym", "2026-08-12", "skipped"),
        // El override de la misma ocurrencia manda sobre el registro.
        record("rent", "2026-10-01", "paid"),
      ],
      finance: { ...emptyStore.finance, incomeEvents: [] },
    };

    expect(summarizeStore(store)).toEqual({ expenses: 0, payments: 2, incomeEvents: 0 });
  });

  it("knows when there is nothing worth copying", () => {
    expect(hasUserData(emptyStore)).toBe(false);
    expect(
      hasUserData({
        ...emptyStore,
        finance: {
          ...emptyStore.finance,
          monthlySalary: { "2026-10": { amount: 2000, dayOfMonth: 28 } },
        },
      }),
    ).toBe(true);
  });
});
