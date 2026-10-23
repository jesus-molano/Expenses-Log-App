import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeExpenseStores } from "@/data/persistence/local-store";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type {
  ExpenseOccurrence,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import {
  dismissLastChanceReminderInStore,
  moveOccurrenceInStore,
  moveOccurrenceOnlyInStore,
  moveOccurrenceSeriesInStore,
  restoreOccurrenceInStore,
  skipOccurrenceInStore,
  togglePaidInStore,
  updateExpenseTemplateInStore,
  updateMonthlyExpenseOccurrenceInStore,
} from "./expense-commands";
import { upsertOccurrenceOverride } from "./occurrence-overrides";

const TEMPLATE: ExpenseTemplate = {
  id: "luz",
  userId: "demo",
  name: "Luz",
  description: "",
  amount: 60,
  currency: "EUR",
  categoryId: "cat-casa",
  startDate: "2026-10-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function storeWith(overrides: ExpenseOccurrenceOverride[] = []): ExpenseStore {
  return { ...emptyStore, templates: [TEMPLATE], overrides };
}

function occurrenceOn(store: ExpenseStore, occurrenceDate: string): ExpenseOccurrence {
  const occurrence = generateStoreOccurrences(store, "2026-10-01", "2026-12-31").find(
    (item) => item.occurrenceDate === occurrenceDate,
  );
  if (!occurrence) throw new Error(`No occurrence on ${occurrenceDate}`);
  return occurrence;
}

describe("occurrence overrides", () => {
  it("keeps a per-occurrence amount when the bill is paid", () => {
    const edited = updateMonthlyExpenseOccurrenceInStore(storeWith(), {
      templateId: "luz",
      occurrenceDate: "2026-11-05",
      dueDate: "2026-11-05",
      status: "due",
      name: "Luz",
      amount: 74.3,
      categoryId: "cat-casa",
    });
    const paid = togglePaidInStore(edited, occurrenceOn(edited, "2026-11-05"));

    expect(paid.overrides).toEqual([
      expect.objectContaining({
        id: "ovr:luz:2026-11-05",
        status: "paid",
        amount: 74.3,
        amountPaid: 74.3,
      }),
    ]);
  });

  it("keeps a moved date and the override when unpaying", () => {
    const moved = moveOccurrenceInStore(
      storeWith(),
      occurrenceOn(storeWith(), "2026-11-05"),
      "2026-10-30",
      3,
    );
    const paid = togglePaidInStore(moved, occurrenceOn(moved, "2026-11-05"));
    const unpaid = togglePaidInStore(paid, occurrenceOn(paid, "2026-11-05"));

    expect(unpaid.overrides).toHaveLength(1);
    expect(unpaid.overrides[0]).toMatchObject({
      dueDate: "2026-10-30",
      sortOrder: 3,
      status: "due",
    });
    expect(unpaid.overrides[0].paidAt).toBeUndefined();
  });

  it("keeps a paid status when the occurrence is moved", () => {
    const paid = togglePaidInStore(storeWith(), occurrenceOn(storeWith(), "2026-11-05"));
    const moved = moveOccurrenceInStore(
      paid,
      occurrenceOn(paid, "2026-11-05"),
      "2026-11-07",
    );

    expect(moved.overrides[0]).toMatchObject({
      status: "paid",
      dueDate: "2026-11-07",
    });
    expect(moved.overrides[0].paidAt).toBeTruthy();
  });

  it("restores a skipped occurrence", () => {
    const skipped = skipOccurrenceInStore(storeWith(), occurrenceOn(storeWith(), "2026-11-05"));
    const restored = restoreOccurrenceInStore(skipped, occurrenceOn(skipped, "2026-11-05"));

    expect(skipped.overrides[0].status).toBe("skipped");
    expect(restored.overrides[0].status).toBe("due");
  });

  it("replaces a legacy random id with the deterministic one", () => {
    const store = storeWith([
      {
        id: "ovr-random",
        userId: "demo",
        templateId: "luz",
        occurrenceDate: "2026-11-05",
        status: "due",
        note: "nota",
      },
    ]);
    const paid = upsertOccurrenceOverride(
      store,
      { templateId: "luz", occurrenceDate: "2026-11-05" },
      { status: "paid" },
    );

    expect(paid.overrides).toEqual([
      expect.objectContaining({ id: "ovr:luz:2026-11-05", status: "paid", note: "nota" }),
    ]);
    expect(paid.deleted?.overrides).toContain("ovr-random");
  });

  it("merges a random-id override and a deterministic one into a single override", () => {
    const local = storeWith([
      {
        id: "ovr-random",
        userId: "demo",
        templateId: "luz",
        occurrenceDate: "2026-11-05",
        status: "paid",
        updatedAt: "2026-11-05T10:00:00.000Z",
      },
    ]);
    const cloud = storeWith([
      {
        id: "ovr:luz:2026-11-05",
        userId: "demo",
        templateId: "luz",
        occurrenceDate: "2026-11-05",
        status: "due",
        updatedAt: "2026-11-01T10:00:00.000Z",
      },
    ]);

    const merged = mergeExpenseStores(
      { ...local, schemaVersion: 3 },
      { ...cloud, schemaVersion: 3 },
    );

    expect(merged.overrides).toEqual([
      expect.objectContaining({ id: "ovr:luz:2026-11-05", status: "paid" }),
    ]);
  });

  it("moves this month's payment when the due day changes and back again", () => {
    const today = new Date(2026, 10, 2, 12);
    const paid = togglePaidInStore(storeWith(), occurrenceOn(storeWith(), "2026-11-05"));

    const toTenth = updateExpenseTemplateInStore(paid, "luz", { dueDay: 10 }, today);
    expect(occurrenceOn(toTenth, "2026-11-10").status).toBe("paid");

    const backToFifth = updateExpenseTemplateInStore(toTenth, "luz", { dueDay: 5 }, today);
    expect(occurrenceOn(backToFifth, "2026-11-05").status).toBe("paid");

    // Otro dispositivo con el estado del día 10 no debe borrar el pago.
    const merged = mergeExpenseStores(
      { ...backToFifth, schemaVersion: 3 },
      { ...toTenth, schemaVersion: 3, templates: backToFifth.templates },
    );
    expect(occurrenceOn(merged, "2026-11-05").status).toBe("paid");
  });

  it("leaves overrides alone when the schedule does not change", () => {
    const paid = togglePaidInStore(storeWith(), occurrenceOn(storeWith(), "2026-11-05"));
    const renamed = updateExpenseTemplateInStore(paid, "luz", { name: "Electricidad" });

    expect(renamed.overrides).toEqual(paid.overrides);
    expect(renamed.templates[0].name).toBe("Electricidad");
  });

  describe("after review", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function at(iso: string) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(iso));
    }

    function editAmount(store: ExpenseStore, occurrenceDate: string, amount: number) {
      return updateMonthlyExpenseOccurrenceInStore(store, {
        templateId: "luz",
        occurrenceDate,
        dueDate: occurrenceDate,
        status: "due",
        name: "Luz",
        amount,
        categoryId: "cat-casa",
      });
    }

    it("keeps an unpaid occurrence's edits when the due day changes and back", () => {
      const today = new Date(2026, 10, 2, 12);
      at("2026-11-02T10:00:00.000Z");
      const edited = editAmount(storeWith(), "2026-11-05", 74.3);

      vi.setSystemTime(new Date("2026-11-02T10:01:00.000Z"));
      const toTenth = updateExpenseTemplateInStore(edited, "luz", { dueDay: 10 }, today);
      expect(occurrenceOn(toTenth, "2026-11-10").template.amount).toBe(74.3);

      vi.setSystemTime(new Date("2026-11-02T10:02:00.000Z"));
      const backToFifth = updateExpenseTemplateInStore(toTenth, "luz", { dueDay: 5 }, today);
      expect(occurrenceOn(backToFifth, "2026-11-05").template.amount).toBe(74.3);

      const merged = mergeExpenseStores(
        { ...backToFifth, schemaVersion: 3 },
        { ...toTenth, schemaVersion: 3, templates: backToFifth.templates },
      );
      expect(occurrenceOn(merged, "2026-11-05").template.amount).toBe(74.3);
    });

    it("undoes a series drag completely when only this month should move", () => {
      at("2026-11-02T10:00:00.000Z");
      const edited = editAmount(storeWith(), "2026-11-05", 74.3);
      const skipped = skipOccurrenceInStore(edited, occurrenceOn(edited, "2026-12-05"));
      const dragged = occurrenceOn(skipped, "2026-11-05");

      vi.setSystemTime(new Date("2026-11-02T10:01:00.000Z"));
      const series = moveOccurrenceSeriesInStore(skipped, dragged, "2026-11-15");
      expect(occurrenceOn(series, "2026-12-15").status).toBe("skipped");

      vi.setSystemTime(new Date("2026-11-02T10:02:00.000Z"));
      const onlyThisMonth = moveOccurrenceOnlyInStore(series, dragged, "2026-11-15");

      expect(onlyThisMonth.templates[0].dueDay).toBe(5);
      expect(occurrenceOn(onlyThisMonth, "2026-11-05")).toMatchObject({
        dueDate: "2026-11-15",
        template: expect.objectContaining({ amount: 74.3 }),
      });
      expect(occurrenceOn(onlyThisMonth, "2026-12-05").status).toBe("skipped");
    });

    it("drops an already moved occurrence where the series drag left it", () => {
      at("2026-11-02T10:00:00.000Z");
      const moved = moveOccurrenceInStore(
        storeWith(),
        occurrenceOn(storeWith(), "2026-11-05"),
        "2026-11-08",
      );

      vi.setSystemTime(new Date("2026-11-02T10:01:00.000Z"));
      const series = moveOccurrenceSeriesInStore(
        moved,
        occurrenceOn(moved, "2026-11-05"),
        "2026-11-15",
      );

      expect(occurrenceOn(series, "2026-11-15").dueDate).toBe("2026-11-15");
    });

    it("does not let a stale device's reminder dismissal undo a payment", () => {
      at("2026-11-04T10:00:00.000Z");
      const base = storeWith();
      const paidOnPhone = togglePaidInStore(base, occurrenceOn(base, "2026-11-05"));

      vi.setSystemTime(new Date("2026-11-04T11:00:00.000Z"));
      const dismissedOnLaptop = dismissLastChanceReminderInStore(
        base,
        occurrenceOn(base, "2026-11-05"),
      );

      for (const merged of [
        mergeExpenseStores(
          { ...dismissedOnLaptop, schemaVersion: 3 },
          { ...paidOnPhone, schemaVersion: 3 },
        ),
        mergeExpenseStores(
          { ...paidOnPhone, schemaVersion: 3 },
          { ...dismissedOnLaptop, schemaVersion: 3 },
        ),
      ]) {
        expect(merged.overrides).toEqual([
          expect.objectContaining({
            status: "paid",
            reminderDismissedAt: "2026-11-04T11:00:00.000Z",
          }),
        ]);
      }
    });

    it("lets a later unpay win over an earlier payment from another device", () => {
      at("2026-11-04T10:00:00.000Z");
      const paid = togglePaidInStore(storeWith(), occurrenceOn(storeWith(), "2026-11-05"));

      vi.setSystemTime(new Date("2026-11-04T11:00:00.000Z"));
      const unpaid = togglePaidInStore(paid, occurrenceOn(paid, "2026-11-05"));

      const merged = mergeExpenseStores(
        { ...paid, schemaVersion: 3 },
        { ...unpaid, schemaVersion: 3 },
      );
      expect(occurrenceOn(merged, "2026-11-05").status).toBe("due");
    });
  });
});
