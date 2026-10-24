import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { FinanceStore } from "@/domain/types";
import type { SalaryExtraPayInput } from "@/stores/app/store-types";
import { type PlanSettingsInput, usePlanSettingsForm } from "../hooks/use-plan-settings-form";
import { PlanSettingsSheet } from "./PlanSettingsSheet";

const finance: FinanceStore = {
  ...emptyFinanceStore,
  monthlySalary: {
    "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
  },
};

function Harness({
  onSave,
  onSaveExtraPay,
}: {
  onSave: (input: PlanSettingsInput) => void;
  onSaveExtraPay: (input: SalaryExtraPayInput) => void;
}) {
  const form = usePlanSettingsForm({
    finance,
    language: "es",
    savingsMonthId: "2026-10",
    onSave,
    onSaveExtraPay,
  });
  if (!form.settingsOpen) {
    return (
      <button type="button" onClick={form.openSettings}>
        Abrir
      </button>
    );
  }
  return (
    <PlanSettingsSheet
      language="es"
      salaryAmount={form.salaryAmount}
      salaryDay={form.salaryDay}
      savingsTarget={form.savingsTarget}
      dayPickerOpen={form.dayPickerOpen}
      extraPayMonths={form.extraPayMonths}
      extraPayAmount={form.extraPayAmount}
      onToggleExtraPayMonth={form.toggleExtraPayMonth}
      onExtraPayAmountChange={form.setExtraPayAmount}
      onSalaryAmountChange={form.setSalaryAmount}
      onSalaryDayChange={form.setSalaryDay}
      onSavingsTargetChange={form.setSavingsTarget}
      onDayPickerOpenChange={form.setDayPickerOpen}
      onClose={form.closeSettings}
      onSubmit={form.submitSettings}
    />
  );
}

function renderSheet(extraPayAmount: string) {
  const onSave = vi.fn();
  const onSaveExtraPay = vi.fn();
  render(<Harness onSave={onSave} onSaveExtraPay={onSaveExtraPay} />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
  fireEvent.click(screen.getByRole("button", { name: "junio" }));
  const amount = screen.getByLabelText(/Importe de cada paga/);
  fireEvent.change(amount, { target: { value: extraPayAmount } });
  const save = screen.getByRole("button", { name: "Guardar configuración" });
  const form = save.closest("form");
  if (!form) throw new Error("PlanSettingsSheet has no form");
  return { amount: amount as HTMLInputElement, form, save, onSave, onSaveExtraPay };
}

describe("PlanSettingsSheet extra pay amount", () => {
  it("blocks saving an amount it cannot read, with a message on the field", () => {
    const { amount, form, save, onSave, onSaveExtraPay } = renderSheet("12,3,4");

    expect(form.checkValidity()).toBe(false);
    expect(amount.validationMessage).toBe("Escribe un importe válido, por ejemplo 15,99 o 0.");
    fireEvent.click(save);

    expect(onSave).not.toHaveBeenCalled();
    expect(onSaveExtraPay).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Base del plan" })).toBeInTheDocument();
  });

  it("saves an empty amount as one more salary", () => {
    const { form, save, onSaveExtraPay } = renderSheet("");

    expect(form.checkValidity()).toBe(true);
    fireEvent.click(save);

    expect(onSaveExtraPay).toHaveBeenCalledWith({
      monthId: "2026-10",
      months: [6],
      amount: undefined,
    });
    expect(screen.getByRole("button", { name: "Abrir" })).toBeInTheDocument();
  });

  it("saves a readable amount", () => {
    const { save, onSaveExtraPay } = renderSheet("1.250,50");

    fireEvent.click(save);

    expect(onSaveExtraPay).toHaveBeenCalledWith({
      monthId: "2026-10",
      months: [6],
      amount: 1250.5,
    });
  });
});
