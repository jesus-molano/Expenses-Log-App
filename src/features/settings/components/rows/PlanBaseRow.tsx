"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { activeBudgetMonth } from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { PlanSettingsFormSheet } from "@/features/plan/components/PlanSettingsSheet";
import { usePlanBaseSettings } from "@/features/plan/hooks/use-plan-base-settings";
import { useCurrentDate } from "@/shared/hooks/use-current-date";
import { t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { describePlanBase } from "../../lib/plan-base-summary";
import { SettingRow } from "../SettingRow";

// Sueldo, día de cobro y ahorro habitual: la misma "Base del plan" que se
// abre desde Mes y desde la guía de Gastos, vigente desde el mes activo.
export function PlanBaseRow({ language }: { language: AppLanguage }) {
  const { store } = useExpenseStore();
  const today = toDateOnly(useCurrentDate());
  const monthId = activeBudgetMonth(store.finance, today).monthId;
  const form = usePlanBaseSettings(monthId);

  return (
    <>
      <SettingRow
        icon={<Wallet size={18} />}
        title={t("settings.planBase", language)}
        description={describePlanBase(store.finance, monthId, language)}
        wrapDescription
        action={
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("settings.planBaseChange", language)}
            onClick={form.openSettings}
          >
            {t("plan.changeBase", language)}
          </Button>
        }
      />
      <PlanSettingsFormSheet form={form} language={language} />
    </>
  );
}
