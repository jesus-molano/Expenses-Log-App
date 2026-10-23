import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyFinanceStore, generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, FinanceStore } from "@/domain/types";
import { useMonthlyExpenseRowEditor } from "./use-monthly-expense-row-editor";
import { useMonthlySalaryEditor } from "./use-monthly-salary-editor";
import { usePlanSettingsForm } from "./use-plan-settings-form";
import { useSalaryPrompt } from "./use-salary-prompt";

const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;

const finance: FinanceStore = {
  ...emptyFinanceStore,
  monthlySalary: {
    "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
  },
  salaryExtraPays: {
    "2026-01": { months: [6, 12], updatedAt: "2026-01-01T00:00:00.000Z" },
  },
};

describe("salary hooks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe("useSalaryPrompt", () => {
    const payday = new Date("2026-10-28T10:00:00");

    it("waits for payday and records the expected salary", () => {
      const recordSalaryReceipt = vi.fn();
      const onRecorded = vi.fn();
      const { result, rerender } = renderHook(
        ({ now }) =>
          useSalaryPrompt({ finance, now, language: "es", recordSalaryReceipt, onRecorded }),
        { initialProps: { now: new Date("2026-10-27T10:00:00") } },
      );

      expect(result.current.prompt).toBeNull();
      rerender({ now: payday });
      expect(result.current.prompt).toMatchObject({ monthId: "2026-10", expectedAmount: 2000 });

      act(() => {
        result.current.confirm();
      });
      const input = { monthId: "2026-10", amount: 2000, receivedOn: "2026-10-28" };
      expect(recordSalaryReceipt).toHaveBeenCalledWith(input);
      expect(onRecorded).toHaveBeenCalledWith(input);
    });

    it("records another amount and ignores an unreadable one", () => {
      const recordSalaryReceipt = vi.fn();
      const { result } = renderHook(() =>
        useSalaryPrompt({ finance, now: payday, language: "es", recordSalaryReceipt }),
      );

      act(() => result.current.startOther());
      expect(result.current.editing).toBe(true);
      expect(result.current.amountText).toBe("2000");

      act(() => result.current.setAmountText("mucho"));
      act(() => result.current.saveOther(submitEvent));
      expect(recordSalaryReceipt).not.toHaveBeenCalled();

      act(() => result.current.setAmountText("2.150,40"));
      act(() => result.current.saveOther(submitEvent));
      expect(recordSalaryReceipt).toHaveBeenCalledWith({
        monthId: "2026-10",
        amount: 2150.4,
        receivedOn: "2026-10-28",
      });
    });

    it("hides with 'Aún no' until tomorrow on this device", () => {
      const options = { finance, language: "es" as const, recordSalaryReceipt: vi.fn() };
      const { result, rerender } = renderHook(({ now }) => useSalaryPrompt({ ...options, now }), {
        initialProps: { now: payday },
      });

      act(() => result.current.dismiss());
      expect(result.current.prompt).toBeNull();

      // Otro montaje el mismo día (recargar) sigue sin preguntar.
      const again = renderHook(() => useSalaryPrompt({ ...options, now: payday }));
      expect(again.result.current.prompt).toBeNull();

      rerender({ now: new Date("2026-10-29T10:00:00") });
      expect(result.current.prompt?.monthId).toBe("2026-10");
    });
  });

  describe("useMonthlySalaryEditor", () => {
    function setup(monthId: string) {
      const onSave = vi.fn();
      const hook = renderHook(() =>
        useMonthlySalaryEditor({
          finance,
          language: "es",
          monthId,
          monthLabel: "mes",
          currentMonthId: "2026-10",
          onSave,
        }),
      );
      return { ...hook, onSave };
    }

    it("proposes only this month when editing a past month", () => {
      const { result, onSave } = setup("2026-08-01");

      act(() => result.current.openEditor());
      expect(result.current.scope).toBe("month");
      act(() => result.current.setAmount("2.400"));
      act(() => result.current.submit(submitEvent));

      expect(onSave).toHaveBeenCalledWith({
        monthId: "2026-08-01",
        salaryAmount: 2400,
        salaryDay: 28,
        scope: "month",
      });
    });

    it("proposes from this month for the current one and lets it change", () => {
      const { result, onSave } = setup("2026-10-01");

      act(() => result.current.openEditor());
      expect(result.current.scope).toBe("fromMonth");
      act(() => result.current.setScope("month"));
      act(() => result.current.submit(submitEvent));

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scope: "month" }));
    });
  });

  describe("usePlanSettingsForm extra pay", () => {
    it("loads, toggles and saves the extra pay months with an optional amount", () => {
      const onSave = vi.fn();
      const onSaveExtraPay = vi.fn();
      const { result } = renderHook(() =>
        usePlanSettingsForm({
          finance,
          language: "es",
          savingsMonthId: "2026-10",
          onSave,
          onSaveExtraPay,
        }),
      );

      act(() => result.current.openSettings());
      expect(result.current.extraPayMonths).toEqual([6, 12]);
      expect(result.current.extraPayAmount).toBe("");

      act(() => result.current.toggleExtraPayMonth(12));
      act(() => result.current.toggleExtraPayMonth(7));
      act(() => result.current.submitSettings(submitEvent));
      expect(onSaveExtraPay).toHaveBeenCalledWith({
        monthId: "2026-10",
        months: [6, 7],
        amount: undefined,
      });

      act(() => result.current.openSettings());
      act(() => result.current.setExtraPayAmount("1.500"));
      act(() => result.current.submitSettings(submitEvent));
      expect(onSaveExtraPay).toHaveBeenLastCalledWith(
        expect.objectContaining({ amount: 1500 }),
      );
    });

    it("does not save with an unreadable extra pay amount", () => {
      const onSave = vi.fn();
      const { result } = renderHook(() =>
        usePlanSettingsForm({ finance, language: "es", savingsMonthId: "2026-10", onSave }),
      );

      act(() => result.current.openSettings());
      act(() => result.current.setExtraPayAmount("una paga"));
      act(() => result.current.submitSettings(submitEvent));
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("useMonthlyExpenseRowEditor", () => {
    const store: ExpenseStore = {
      ...emptyStore,
      templates: [
        {
          id: "luz",
          userId: "demo",
          name: "Luz",
          description: "",
          amount: 60,
          currency: "EUR",
          categoryId: "cat",
          startDate: "2026-10-08",
          dueDay: 8,
          recurrence: { frequency: "monthly" },
          active: true,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    };
    const occurrence = generateStoreOccurrences(store, "2026-10-01", "2026-10-31")[0];

    it("sends what was paid apart from the planned amount", () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMonthlyExpenseRowEditor({ occurrence, categories: [], language: "es", onUpdate }),
      );

      act(() => result.current.openEditor());
      act(() => result.current.setStatus("paid"));
      act(() => result.current.setPaidAmount("74,30"));
      act(() => result.current.save());

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 60, status: "paid", amountPaid: 74.3 }),
      );
    });

    it("keeps editing with an unreadable paid amount and sends none when pending", () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useMonthlyExpenseRowEditor({ occurrence, categories: [], language: "es", onUpdate }),
      );

      act(() => result.current.openEditor());
      act(() => result.current.setStatus("paid"));
      act(() => result.current.setPaidAmount("??"));
      act(() => result.current.save());
      expect(onUpdate).not.toHaveBeenCalled();
      expect(result.current.editing).toBe(true);

      act(() => result.current.setStatus("due"));
      act(() => result.current.save());
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "due", amountPaid: undefined }),
      );
    });
  });
});
