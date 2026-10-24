import { formatCurrency } from "@/domain/calendar";
import { getMonthlySalarySettings, getMonthlySavingsTarget } from "@/domain/finance";
import type { AppLanguage, FinanceStore } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";

// Lo que dice la fila "Sueldo y ahorro" de Ajustes: la base del plan del mes
// activo o, sin sueldo, para qué sirve.
export function describePlanBase(
  finance: FinanceStore,
  monthId: string,
  language: AppLanguage,
) {
  const salary = getMonthlySalarySettings(finance, monthId);
  if (salary.amount <= 0) return t("money.configureMoneySubtitle", language);
  return formatMessage(
    "settings.planBaseSummary",
    {
      salary: formatCurrency(salary.amount),
      day: salary.dayOfMonth,
      savings: formatCurrency(getMonthlySavingsTarget(finance, monthId)),
    },
    language,
  );
}
