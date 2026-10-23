import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  formatSkippedRows,
  formatStorageSize,
  formatStoreSummary,
  importErrorMessage,
  previewImport,
  snapshotReasonLabel,
} from "./backup-summary";

function template(id: string, updatedAt: string): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount: 10,
    currency: "EUR",
    categoryId: "cat",
    startDate: "2026-10-01",
    dueDay: 1,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("backup summary", () => {
  it("summarises counts with the singular and plural in both languages", () => {
    expect(formatStoreSummary({ expenses: 18, payments: 1, incomeEvents: 0 }, "es")).toBe(
      "18 gastos · 1 pago · 0 ingresos",
    );
    expect(formatStoreSummary({ expenses: 1, payments: 42, incomeEvents: 3 }, "en")).toBe(
      "1 expense · 42 payments · 3 income entries",
    );
    expect(formatSkippedRows(1, "es")).toBe("Se ignora 1 fila que no se puede leer.");
    expect(formatSkippedRows(4, "en")).toBe("4 unreadable rows are skipped.");
  });

  it("previews what each import mode would leave", () => {
    const current: ExpenseStore = {
      ...emptyStore,
      templates: [template("rent", "2026-10-01T00:00:00.000Z"), template("gym", "2026-10-01T00:00:00.000Z")],
    };
    const imported: ExpenseStore = {
      ...emptyStore,
      templates: [template("rent", "2026-09-01T00:00:00.000Z"), template("netflix", "2026-09-01T00:00:00.000Z")],
    };

    expect(
      previewImport(current, { store: imported, scope: "all" }, new Date("2026-10-23T10:00:00Z")),
    ).toEqual({
      file: { expenses: 2, payments: 0, incomeEvents: 0 },
      merge: { expenses: 3, payments: 0, incomeEvents: 0 },
      replace: { expenses: 2, payments: 0, incomeEvents: 0 },
    });
  });

  it("formats storage sizes and labels", () => {
    expect(formatStorageSize(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
    expect(formatStorageSize(2048, "es")).toMatch(/^2\s?kB$/);
    expect(snapshotReasonLabel("before-import", "es")).toBe("Antes de importar");
    expect(importErrorMessage("csv-columns", "en")).toBe(
      "The CSV is missing the name and amount columns.",
    );
  });
});
