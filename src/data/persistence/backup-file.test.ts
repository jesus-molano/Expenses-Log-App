import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { BackupFileError } from "./backup-errors";
import {
  BACKUP_FILE_KIND,
  MAX_BACKUP_FILE_BYTES,
  backupFileName,
  buildJsonBackup,
  parseBackupFile,
} from "./backup-file";

const now = new Date("2026-10-23T10:00:00");

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    {
      id: "rent",
      userId: "user-1",
      name: "Alquiler",
      description: "",
      amount: 700,
      currency: "EUR",
      categoryId: "cat-home",
      startDate: "2026-10-01",
      dueDay: 1,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  finance: {
    ...emptyStore.finance,
    monthlySalary: {
      "2026-10": { amount: 2200, dayOfMonth: 28, updatedAt: "2026-10-01T00:00:00.000Z" },
    },
  },
};

function errorCode(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof BackupFileError ? error.code : "other";
  }
}

describe("backup file", () => {
  it("wraps the full store with its kind, version and date", () => {
    const payload = JSON.parse(buildJsonBackup(store, now));

    expect(payload).toMatchObject({
      kind: BACKUP_FILE_KIND,
      version: 1,
      exportedAt: now.toISOString(),
      store: { templates: [{ id: "rent" }] },
    });
    expect(backupFileName("json", now)).toBe("expense-log-2026-10-23.json");
    expect(backupFileName("csv", now)).toBe("expense-log-2026-10-23.csv");
  });

  it("reads its own backups back into a normalized store", () => {
    const parsed = parseBackupFile({ name: "copia.json", text: buildJsonBackup(store, now) });

    expect(parsed).toMatchObject({
      format: "json",
      scope: "all",
      exportedAt: now.toISOString(),
      skippedRows: 0,
    });
    expect(parsed.store.templates).toEqual([expect.objectContaining({ id: "rent", amount: 700 })]);
    expect(parsed.store.finance.monthlySalary["2026-10"]).toMatchObject({ amount: 2200 });
  });

  it("round-trips pauses, price changes, extra pays, salary answers and one-month salaries", () => {
    const withMoney: ExpenseStore = {
      ...store,
      templates: [
        {
          ...store.templates[0],
          amountChanges: [{ from: "2027-01-01", amount: 720 }],
          pauses: [{ from: "2026-12-01", to: "2026-12-31" }, { from: "2027-06-01" }],
        },
      ],
      finance: {
        ...store.finance,
        monthlySalary: {
          ...store.finance.monthlySalary,
          "2026-11": {
            amount: 4000,
            dayOfMonth: 28,
            updatedAt: "2026-10-20T00:00:00.000Z",
            onlyThisMonth: true,
          },
        },
        salaryExtraPays: {
          "2026-10": { months: [6, 12], amount: 1500, updatedAt: "2026-10-01T00:00:00.000Z" },
        },
        salaryReceipts: {
          "2026-09": {
            amount: 2150,
            receivedOn: "2026-09-28",
            updatedAt: "2026-09-28T10:00:00.000Z",
          },
          "2026-08": {
            amount: 2200,
            receivedOn: "2026-08-28",
            updatedAt: "2026-08-29T10:00:00.000Z",
            undone: true,
          },
        },
      },
    };
    const parsed = parseBackupFile({ name: "copia.json", text: buildJsonBackup(withMoney, now) });

    expect(parsed.store.templates[0]).toMatchObject({
      amountChanges: withMoney.templates[0].amountChanges,
      pauses: withMoney.templates[0].pauses,
    });
    expect(parsed.store.finance.monthlySalary["2026-11"]).toEqual(
      withMoney.finance.monthlySalary["2026-11"],
    );
    expect(parsed.store.finance.salaryExtraPays).toEqual(withMoney.finance.salaryExtraPays);
    expect(parsed.store.finance.salaryReceipts).toEqual(withMoney.finance.salaryReceipts);
  });

  it("also accepts a bare store, as older exports and localStorage dumps have", () => {
    const parsed = parseBackupFile({ name: "store.txt", text: JSON.stringify(store) });

    expect(parsed.format).toBe("json");
    expect(parsed.exportedAt).toBeUndefined();
    expect(parsed.store.templates).toHaveLength(1);
  });

  it("sends anything that is not JSON to the CSV reader", () => {
    const parsed = parseBackupFile(
      { name: "gastos.csv", text: "﻿name,amount\nLuz,64.75\n" },
      { now },
    );

    expect(parsed).toMatchObject({ format: "csv", scope: "expenses", skippedRows: 0 });
    expect(parsed.store.templates).toEqual([expect.objectContaining({ name: "Luz", amount: 64.75 })]);
  });

  it("explains why a file cannot be imported", () => {
    expect(errorCode(() => parseBackupFile({ name: "a.json", text: "  " }))).toBe("empty");
    expect(errorCode(() => parseBackupFile({ name: "a.json", text: "{nope" }))).toBe("unreadable");
    expect(errorCode(() => parseBackupFile({ name: "a.json", text: '{"hello":1}' }))).toBe(
      "not-a-backup",
    );
    expect(errorCode(() => parseBackupFile({ name: "a.json", text: "[1,2]" }))).toBe(
      "not-a-backup",
    );
    expect(
      errorCode(() =>
        parseBackupFile({ name: "a.json", text: "x".repeat(MAX_BACKUP_FILE_BYTES + 1) }),
      ),
    ).toBe("too-large");
  });
});
