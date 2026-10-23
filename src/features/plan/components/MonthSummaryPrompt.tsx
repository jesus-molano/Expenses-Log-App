import { ChevronRight, ClipboardList } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { capitalize, formatMonthName } from "@/features/expenses/lib/month-view";
import { t } from "@/shared/i18n";
import type { MonthSummary } from "../lib/month-summary";

// Acceso al resumen de un mes al terminarlo o al cerrarlo: "Resumen de
// octubre · 12 de 12 pagados · 300 € ahorrado".
export function MonthSummaryPrompt({
  summary,
  language,
  onOpen,
}: {
  summary: MonthSummary;
  language: AppLanguage;
  onOpen: () => void;
}) {
  return (
    <div className="app-plan-actions rounded-[var(--app-radius-lg)] p-1">
      <button
        type="button"
        onClick={onOpen}
        className="app-plan-action-row app-focus-ring flex min-h-14 w-full items-center gap-3 rounded-[var(--app-radius-md)] px-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-control)] text-[var(--app-accent)]">
          <ClipboardList size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-[var(--app-text)]">
            {capitalize(
              t("insights.summary.title", language).replace(
                "{month}",
                formatMonthName(summary.monthId, language),
              ),
            )}
          </span>
          <span className="app-money mt-0.5 block break-words text-xs text-[var(--app-text-muted)]">
            {t("insights.summary.promptDetail", language)
              .replace("{paid}", String(summary.paidCount))
              .replace("{total}", String(summary.plannedCount))
              .replace("{saved}", formatCurrency(summary.savingsActual))}
          </span>
        </span>
        <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-[var(--app-text-muted)]" />
      </button>
    </div>
  );
}
