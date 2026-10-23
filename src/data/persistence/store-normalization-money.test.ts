import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { mergeExpenseStores } from "./local-store";
import { normalizeExpenseStore } from "./store-normalization";

const TODAY = new Date("2026-10-23T10:00:00");

const template: ExpenseTemplate = {
  id: "netflix",
  userId: "demo",
  name: "Netflix",
  description: "",
  amount: 12,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-10-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function normalize(value: unknown) {
  return normalizeExpenseStore(value, TODAY);
}

describe("normalizing price changes, pauses and salary extras", () => {
  it("loads an old store without the new fields untouched", () => {
    const store = normalize({ ...emptyStore, templates: [template] });

    expect(store.templates[0]).toBe(template);
    expect(store.finance).not.toHaveProperty("salaryExtraPays");
    expect(store.finance).not.toHaveProperty("salaryReceipts");
  });

  it("keeps valid price changes and pauses as they are", () => {
    const withChanges: ExpenseTemplate = {
      ...template,
      amountChanges: [{ from: "2027-03-01", amount: 15 }],
      pauses: [{ from: "2026-11-01", to: "2026-12-31" }, { from: "2027-06-01" }],
    };

    expect(normalize({ ...emptyStore, templates: [withChanges] }).templates[0]).toBe(withChanges);
  });

  it("drops unreadable price changes, keeps one per date and sorts them", () => {
    const store = normalize({
      ...emptyStore,
      templates: [
        {
          ...template,
          amountChanges: [
            { from: "2027-06-01", amount: 18 },
            { from: "2027-03-01", amount: 14 },
            { from: "2027-03-01", amount: 15 },
            { from: "marzo", amount: 20 },
            { from: "2027-04-01", amount: 0 },
            { from: "2027-05-01", amount: "dos" },
            "basura",
          ],
        },
      ],
    });

    expect(store.templates[0].amountChanges).toEqual([
      { from: "2027-03-01", amount: 15 },
      { from: "2027-06-01", amount: 18 },
    ]);
  });

  it("drops pauses that would hide charges forever by mistake", () => {
    const store = normalize({
      ...emptyStore,
      templates: [
        {
          ...template,
          pauses: [
            { from: "2027-01-01", to: "2026-12-01" },
            { from: "2026-11-01", to: "pronto" },
            { from: "2026-12-01", to: null },
            { from: "nunca" },
          ],
        },
      ],
    });

    expect(store.templates[0].pauses).toEqual([{ from: "2026-12-01" }]);
  });

  it("removes empty lists instead of keeping them", () => {
    const store = normalize({
      ...emptyStore,
      templates: [{ ...template, amountChanges: [], pauses: [{ from: "x" }] }],
    });

    expect(store.templates[0]).not.toHaveProperty("amountChanges");
    expect(store.templates[0]).not.toHaveProperty("pauses");
  });

  it("keeps one-month salaries, extra pay and salary answers", () => {
    const store = normalize({
      ...emptyStore,
      finance: {
        ...emptyStore.finance,
        monthlySalary: {
          "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
          "2026-06": {
            amount: 4000,
            dayOfMonth: 28,
            updatedAt: "2026-06-01T00:00:00.000Z",
            onlyThisMonth: true,
          },
          "2026-07": { amount: 2000, dayOfMonth: 28, onlyThisMonth: "yes" },
        },
        salaryExtraPays: {
          "2026-01": { months: [12, "6", 6, 14], updatedAt: "2026-01-01T00:00:00.000Z" },
          "2027-01": { months: [7], amount: 1500 },
          bad: { months: [6] },
        },
        salaryReceipts: {
          "2026-10": { amount: 2150, receivedOn: "2026-10-28", updatedAt: "2026-10-28T09:00:00.000Z" },
          "2026-09": {
            amount: 2000,
            receivedOn: "2026-09-28",
            updatedAt: "2026-09-28T09:00:00.000Z",
            undone: true,
          },
          "2026-08": { amount: "mucho", receivedOn: "2026-08-28" },
          "2026-07": { amount: 2000, receivedOn: "ayer" },
        },
      },
    });

    expect(store.finance.monthlySalary["2026-06"].onlyThisMonth).toBe(true);
    expect(store.finance.monthlySalary["2026-07"]).not.toHaveProperty("onlyThisMonth");
    expect(store.finance.salaryExtraPays).toEqual({
      "2026-01": { months: [6, 12], updatedAt: "2026-01-01T00:00:00.000Z" },
      "2027-01": { months: [7], amount: 1500, updatedAt: "2027-01-01T00:00:00.000Z" },
    });
    expect(store.finance.salaryReceipts).toEqual({
      "2026-10": { amount: 2150, receivedOn: "2026-10-28", updatedAt: "2026-10-28T09:00:00.000Z" },
      "2026-09": {
        amount: 2000,
        receivedOn: "2026-09-28",
        updatedAt: "2026-09-28T09:00:00.000Z",
        undone: true,
      },
    });
  });

  it("survives load, save and load again", () => {
    const store = normalize({
      ...emptyStore,
      templates: [{ ...template, amountChanges: [{ from: "2027-03-01", amount: 15 }] }],
      finance: {
        ...emptyStore.finance,
        salaryExtraPays: { "2026-01": { months: [6], updatedAt: "2026-01-01T00:00:00.000Z" } },
      },
    });

    expect(normalize(JSON.parse(JSON.stringify(store)))).toEqual(store);
  });
});

describe("merging price changes, pauses and salary extras", () => {
  function storeWith(partial: Partial<ExpenseStore>): ExpenseStore {
    return normalize({ ...emptyStore, ...partial });
  }

  it("takes the template edited last, with its prices and pauses", () => {
    const cloud = storeWith({
      templates: [
        {
          ...template,
          pauses: [{ from: "2026-11-01" }],
          updatedAt: "2026-10-20T00:00:00.000Z",
        },
      ],
    });
    const local = storeWith({
      templates: [
        {
          ...template,
          amountChanges: [{ from: "2027-01-01", amount: 14 }],
          updatedAt: "2026-10-22T00:00:00.000Z",
        },
      ],
    });

    const merged = mergeExpenseStores(local, cloud);

    expect(merged.templates[0].amountChanges).toEqual([{ from: "2027-01-01", amount: 14 }]);
    expect(merged.templates[0].pauses).toBeUndefined();
  });

  it("keeps per month the extra pay and salary answer changed last", () => {
    const cloud = storeWith({
      finance: {
        ...emptyStore.finance,
        salaryExtraPays: {
          "2026-01": { months: [6, 12], updatedAt: "2026-10-20T00:00:00.000Z" },
        },
        salaryReceipts: {
          "2026-10": { amount: 2000, receivedOn: "2026-10-28", updatedAt: "2026-10-28T09:00:00.000Z" },
          "2026-09": { amount: 1900, receivedOn: "2026-09-28", updatedAt: "2026-09-28T09:00:00.000Z" },
        },
      },
    });
    const local = storeWith({
      finance: {
        ...emptyStore.finance,
        salaryExtraPays: {
          "2026-01": { months: [7], updatedAt: "2026-10-10T00:00:00.000Z" },
        },
        salaryReceipts: {
          "2026-10": {
            amount: 2000,
            receivedOn: "2026-10-28",
            updatedAt: "2026-10-28T09:01:00.000Z",
            undone: true,
          },
        },
      },
    });

    const merged = mergeExpenseStores(local, cloud);

    expect(merged.finance.salaryExtraPays?.["2026-01"].months).toEqual([6, 12]);
    expect(merged.finance.salaryReceipts?.["2026-10"].undone).toBe(true);
    expect(merged.finance.salaryReceipts?.["2026-09"].amount).toBe(1900);
  });

  it("does not add the new keys when neither side has them", () => {
    const merged = mergeExpenseStores(storeWith({}), storeWith({}));

    expect(merged.finance).not.toHaveProperty("salaryExtraPays");
    expect(merged.finance).not.toHaveProperty("salaryReceipts");
  });
});
