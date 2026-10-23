import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { IncomeEvent } from "@/domain/types";
import { useIncomeEventRowEditor } from "./use-income-event-row-editor";
import { usePlanSettingsForm } from "./use-plan-settings-form";

const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;

describe("plan editors", () => {
  it("does not save settings when an amount cannot be read", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      usePlanSettingsForm({
        finance: emptyFinanceStore,
        language: "es",
        savingsMonthId: "2026-10",
        onSave,
      }),
    );

    act(() => result.current.setSalaryAmount("dos mil"));
    act(() => result.current.submitSettings(submitEvent));
    expect(onSave).not.toHaveBeenCalled();

    act(() => result.current.setSalaryAmount("2.200,"));
    act(() => result.current.submitSettings(submitEvent));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ salaryAmount: 2200, savingsTarget: 0 }),
    );
  });

  it("keeps an income row open instead of saving 0", () => {
    const onUpdate = vi.fn();
    const event: IncomeEvent = {
      id: "income-1",
      userId: "demo",
      name: "Bizum",
      amount: 45,
      currency: "EUR",
      receivedAt: "2026-10-02",
      createdAt: "2026-10-02T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    };
    const { result } = renderHook(() =>
      useIncomeEventRowEditor({ event, language: "es", onUpdate }),
    );

    act(() => result.current.openEditor());
    act(() => result.current.setAmount("abc"));
    act(() => result.current.save());

    expect(onUpdate).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(true);
  });
});
