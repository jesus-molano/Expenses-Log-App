import type { AppLanguage, RecurrenceRule } from "@/domain/types";
import { t } from "@/shared/i18n";

export function localizedRecurrenceLabel(
  rule: RecurrenceRule,
  language: AppLanguage,
): string {
  if (rule.frequency === "monthly") return t("expenses.monthly", language);
  if (rule.frequency === "quarterly") return t("expenses.quarterly", language);
  if (rule.frequency === "yearly") return t("expenses.yearly", language);
  if (rule.frequency === "custom") return t("expenses.custom", language);
  return rule.frequency.toUpperCase();
}
