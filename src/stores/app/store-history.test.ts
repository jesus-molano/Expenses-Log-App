import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseOccurrenceRecord, ExpenseStore } from "@/domain/types";
import { preserveClosedOccurrenceRecords } from "./store-history";

const today = new Date("2026-08-23T12:00:00.000Z");

function record(
  plannedAmount: number,
  updatedAt: string,
): ExpenseOccurrenceRecord {
  return {
    id: "record:expense:2026-06-10",
    userId: "demo",
    templateId: "expense",
    occurrenceDate: "2026-06-10",
    monthId: "2026-06",
    dueDate: "2026-06-10",
    name: "Internet",
    description: "",
    plannedAmount,
    currency: "EUR",
    categoryId: "cat-services",
    categoryName: "Servicios",
    status: "due",
    sortOrder: 0,
    source: "native",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt,
  };
}

function withRecords(
  occurrenceRecords: ExpenseOccurrenceRecord[],
): ExpenseStore {
  return {
    ...emptyStore,
    schemaVersion: 2,
    occurrenceRecords,
  };
}

describe("preserveClosedOccurrenceRecords", () => {
  it("keeps a newer correction from the store being persisted", () => {
    const currentStore = withRecords([
      record(30, "2026-08-20T10:00:00.000Z"),
    ]);
    const nextStore = withRecords([
      record(35, "2026-08-23T10:00:00.000Z"),
    ]);

    const preserved = preserveClosedOccurrenceRecords(
      currentStore,
      nextStore,
      today,
    );

    expect(preserved.occurrenceRecords).toMatchObject([
      { plannedAmount: 35, updatedAt: "2026-08-23T10:00:00.000Z" },
    ]);
  });

  it("adds a closed record that the next store does not contain yet", () => {
    const currentStore = withRecords([
      record(30, "2026-08-20T10:00:00.000Z"),
    ]);

    const preserved = preserveClosedOccurrenceRecords(
      currentStore,
      withRecords([]),
      today,
    );

    expect(preserved.occurrenceRecords).toMatchObject([
      { plannedAmount: 30 },
    ]);
  });
});
