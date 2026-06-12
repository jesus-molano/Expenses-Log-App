import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { recurrenceLabel } from "@/domain/recurrence";
import type { AppLanguage, RecurrenceRule } from "@/domain/types";

export function recurringFrequencyLabel(
  rule: RecurrenceRule,
  language: AppLanguage,
) {
  if (language === "es") return recurrenceLabel(rule);

  if (rule.frequency === "once") return "One-time";
  if (rule.frequency === "monthly") return "Monthly";
  if (rule.frequency === "quarterly") return "Quarterly";
  if (rule.frequency === "yearly") return "Yearly";
  if (rule.frequency === "rrule") return "Advanced";

  const interval = rule.interval ?? 1;
  const unit = rule.unit ?? "month";
  const units = {
    day: "days",
    week: "weeks",
    month: "months",
    year: "years",
  };

  return `Every ${interval} ${units[unit]}`;
}

export function formatRecurringDate(date: string, language: AppLanguage) {
  const locale = language === "en" ? enUS : es;
  return format(parseISO(date), "d MMM yyyy", { locale });
}
