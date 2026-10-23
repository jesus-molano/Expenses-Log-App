import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getExpectedSalary,
  getMonthlySalarySettings,
  getSalaryReceipt,
} from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import {
  clearIncomeFromStore,
  recordSalaryReceiptInStore,
  undoSalaryReceiptInStore,
  updateMonthlySalaryInStore,
  updateSalaryExtraPayInStore,
} from "./store-commands";

function withSalaries(monthlySalary: ExpenseStore["finance"]["monthlySalary"]): ExpenseStore {
  return { ...emptyStore, finance: { ...emptyStore.finance, monthlySalary } };
}

function amounts(store: ExpenseStore, months: string[]) {
  return months.map((month) => getMonthlySalarySettings(store.finance, month).amount);
}

const at = (month: string, amount: number) => ({
  amount,
  dayOfMonth: 28,
  updatedAt: `${month}-01T00:00:00.000Z`,
});

describe("salary commands", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("editing a month salary (M16)", () => {
    const base = withSalaries({ "2026-01": at("2026-01", 2000) });

    it("changes only that month with 'solo este mes'", () => {
      const updated = updateMonthlySalaryInStore(base, {
        monthId: "2026-12-01",
        salaryAmount: 4000,
        salaryDay: 28,
        scope: "month",
      });

      expect(amounts(updated, ["2026-11", "2026-12", "2027-01"])).toEqual([2000, 4000, 2000]);
      expect(updated.finance.monthlySalary["2026-12"]).toMatchObject({ onlyThisMonth: true });
      expect(updated.finance.monthlySalary["2027-01"]).toBeUndefined();
    });

    it("keeps a raise that started that month for the following ones", () => {
      const raised = withSalaries({
        "2026-01": at("2026-01", 2000),
        "2026-10": at("2026-10", 2200),
      });

      const updated = updateMonthlySalaryInStore(raised, {
        monthId: "2026-10",
        salaryAmount: 2500,
        salaryDay: 28,
        scope: "month",
      });

      expect(amounts(updated, ["2026-09", "2026-10", "2026-11", "2027-03"])).toEqual([
        2000, 2500, 2200, 2200,
      ]);
    });

    it("changes that month and the following ones with 'desde este mes'", () => {
      const withOneOff = updateMonthlySalaryInStore(base, {
        monthId: "2027-02",
        salaryAmount: 3000,
        salaryDay: 28,
        scope: "month",
      });

      const updated = updateMonthlySalaryInStore(withOneOff, {
        monthId: "2026-10",
        salaryAmount: 2100,
        salaryDay: 27,
        scope: "fromMonth",
      });

      // El mes con su propio sueldo lo conserva; el resto sigue el nuevo.
      expect(amounts(updated, ["2026-09", "2026-10", "2027-01", "2027-02", "2027-03"])).toEqual([
        2000, 2100, 2100, 3000, 2100,
      ]);
      expect(updated.finance.monthlySalary["2026-10"].onlyThisMonth).toBeUndefined();
    });

    it("applies a past month 'desde este mes' to the current one too", () => {
      const updated = updateMonthlySalaryInStore(base, {
        monthId: "2026-08",
        salaryAmount: 2300,
        salaryDay: 28,
        scope: "fromMonth",
      });

      expect(amounts(updated, ["2026-07", "2026-08", "2026-10"])).toEqual([2000, 2300, 2300]);
    });

    it("keeps the previous behaviour without a scope", () => {
      const updated = updateMonthlySalaryInStore(base, {
        monthId: "2026-08",
        salaryAmount: 2300,
        salaryDay: 28,
      });

      expect(amounts(updated, ["2026-08", "2026-09", "2026-10"])).toEqual([2300, 2000, 2000]);
    });
  });

  describe("extra pay", () => {
    it("saves sanitized months from a month and skips unchanged settings", () => {
      const base = withSalaries({ "2026-01": at("2026-01", 2000) });

      const updated = updateSalaryExtraPayInStore(base, {
        monthId: "2026-10-01",
        months: [12, 6, 6, 13, 0],
      });

      expect(updated.finance.salaryExtraPays?.["2026-10"]).toMatchObject({ months: [6, 12] });
      expect(updated.finance.salaryExtraPays?.["2026-10"].amount).toBeUndefined();
      expect(getExpectedSalary(updated.finance, "2026-12")).toBe(4000);
      expect(
        updateSalaryExtraPayInStore(updated, { monthId: "2026-11", months: [6, 12] }),
      ).toBe(updated);
      expect(
        updateSalaryExtraPayInStore(updated, { monthId: "2026-11", months: [6, 12], amount: 1000 })
          .finance.salaryExtraPays?.["2026-11"],
      ).toMatchObject({ months: [6, 12], amount: 1000 });
    });
  });

  describe("'¿Has cobrado?'", () => {
    it("records the amount received and undoes it with a later version", () => {
      const recorded = recordSalaryReceiptInStore(emptyStore, {
        monthId: "2026-10",
        amount: 2150,
        receivedOn: "2026-10-28",
      });

      expect(getSalaryReceipt(recorded.finance, "2026-10")).toMatchObject({ amount: 2150 });

      const undone = undoSalaryReceiptInStore(recorded, "2026-10");
      const receipt = undone.finance.salaryReceipts?.["2026-10"];

      expect(getSalaryReceipt(undone.finance, "2026-10")).toBeNull();
      expect(receipt?.undone).toBe(true);
      // Aunque el reloj no avance, la versión deshecha es posterior.
      expect(receipt!.updatedAt > recorded.finance.salaryReceipts!["2026-10"].updatedAt).toBe(true);
      expect(undoSalaryReceiptInStore(undone, "2026-10")).toBe(undone);
    });

    it("rejects an unreadable answer", () => {
      expect(
        recordSalaryReceiptInStore(emptyStore, { monthId: "2026-10", amount: Number.NaN, receivedOn: "2026-10-28" }),
      ).toBe(emptyStore);
      expect(
        recordSalaryReceiptInStore(emptyStore, { monthId: "2026-10", amount: 10, receivedOn: "28/10" }),
      ).toBe(emptyStore);
    });

    it("clears extra pay and answers together with the income", () => {
      const store = recordSalaryReceiptInStore(
        updateSalaryExtraPayInStore(withSalaries({ "2026-01": at("2026-01", 2000) }), {
          monthId: "2026-01",
          months: [6, 12],
        }),
        { monthId: "2026-10", amount: 2000, receivedOn: "2026-10-28" },
      );

      const cleared = clearIncomeFromStore(store);

      expect(cleared.finance.salaryExtraPays?.["2026-01"].months).toEqual([]);
      expect(getSalaryReceipt(cleared.finance, "2026-10")).toBeNull();
      expect(getExpectedSalary(cleared.finance, "2026-12")).toBe(0);
    });
  });
});
