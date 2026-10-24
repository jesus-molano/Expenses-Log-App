import { CalendarRange } from "lucide-react";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

// Mes natural o ciclo que empieza el día de cobro. Gastos y Mes cuentan los
// recibos según lo que se elija aquí.
export function BudgetCycleRow({ settings }: { settings: SettingsController }) {
  const { budgetCycle } = settings;

  return (
    <SettingRow
      icon={<CalendarRange size={18} />}
      title={t("insights.cycle.title", settings.currentLanguage)}
      description={budgetCycle.summary}
      wrapDescription
      action={
        <SelectMenu
          open={settings.budgetCycleOpen}
          onOpenChange={settings.setBudgetCycleOpen}
          value={budgetCycle.anchor}
          label={budgetCycle.shortLabel}
          onChange={(value) => settings.updateBudgetCycle(value)}
          options={budgetCycle.options}
        />
      }
    />
  );
}
