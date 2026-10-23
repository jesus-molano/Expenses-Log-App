import type { AppLanguage, RecurrenceRule } from "@/domain/types";
import { formatMessage, t, type TranslationKey } from "@/shared/i18n";

const EVERY_UNIT: Record<
  NonNullable<RecurrenceRule["unit"]>,
  { one: TranslationKey; many: TranslationKey }
> = {
  day: { one: "expenses.everyDay", many: "expenses.everyDays" },
  week: { one: "expenses.everyWeek", many: "expenses.everyWeeks" },
  month: { one: "expenses.everyMonth", many: "expenses.everyMonths" },
  year: { one: "expenses.everyYear", many: "expenses.everyYears" },
};

// Etiqueta de la repetición de un gasto ("Mensual", "Cada 2 semanas").
export function localizedRecurrenceLabel(
  rule: RecurrenceRule,
  language: AppLanguage,
): string {
  if (rule.frequency === "once") return t("expenses.once", language);
  if (rule.frequency === "monthly") return t("expenses.monthly", language);
  if (rule.frequency === "quarterly") return t("expenses.quarterly", language);
  if (rule.frequency === "yearly") return t("expenses.yearly", language);
  if (rule.frequency === "rrule") return t("expenses.advancedRecurrence", language);

  const count = Math.max(Math.round(rule.interval ?? 1), 1);
  const keys = EVERY_UNIT[rule.unit ?? "month"] ?? EVERY_UNIT.month;
  return count === 1
    ? t(keys.one, language)
    : formatMessage(keys.many, { count }, language);
}
