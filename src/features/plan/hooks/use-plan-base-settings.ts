"use client";

import { useExpenseStore } from "@/stores/app/use-expense-store";
import { usePlanSettingsForm } from "./use-plan-settings-form";

// "Base del plan" (sueldo, día de cobro, ahorro habitual y pagas extra)
// guardada con los comandos del store. Rige desde `savingsMonthId`, el mes
// activo aunque se mire otro.
export function usePlanBaseSettings(savingsMonthId: string) {
  const { store, updateMoneySettings, updateSalaryExtraPay } = useExpenseStore();
  return usePlanSettingsForm({
    finance: store.finance,
    language: store.preferences?.language ?? "es",
    savingsMonthId,
    onSave: updateMoneySettings,
    onSaveExtraPay: updateSalaryExtraPay,
  });
}
