import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { IncomeEventInput } from "@/stores/app/store-types";
import { isSavingsGoalUnregistered, type MonthSummary } from "../lib/month-summary";
import { MonthlyIncomeEventsList } from "./MonthlyIncomeEventsList";

export type MonthSummaryReviewActions = {
  incomeEvents: IncomeEvent[];
  onEditSalary: () => void;
  onEditSavings: () => void;
  onDeleteIncomeEvent: (id: string) => void;
  onUpdateIncomeEvent: (id: string, input: IncomeEventInput) => void;
};

// Lo que antes era la revisión mensual, dentro del resumen del mes: corregir
// el ingreso fijo y el ahorro, registrar el ahorro que falta y repasar los
// ingresos puntuales.
export function MonthSummaryReview({
  summary,
  language,
  incomeEvents,
  onEditSalary,
  onEditSavings,
  onDeleteIncomeEvent,
  onUpdateIncomeEvent,
}: MonthSummaryReviewActions & {
  summary: MonthSummary;
  language: AppLanguage;
}) {
  return (
    <>
      {isSavingsGoalUnregistered(summary) ? (
        <div className="mt-5 grid gap-2 rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-warning)_10%,transparent)] px-3 py-3">
          <div className="flex items-start gap-2">
            <TriangleAlert
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--app-warning)]"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--app-warning)]">
                {t("monthClose.goalNotRegistered", language)}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-text-muted)]">
                {t("monthClose.goalNotRegisteredBody", language)}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="justify-self-start"
            onClick={onEditSavings}
          >
            {t("monthClose.registerSavings", language)}
          </Button>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onEditSalary}>
          {t("plan.editFixedIncome", language)}
        </Button>
        <Button size="sm" variant="secondary" onClick={onEditSavings}>
          {t("plan.editSavings", language)}
        </Button>
      </div>

      <MonthlyIncomeEventsList
        className="mt-6"
        language={language}
        incomeEvents={incomeEvents}
        onDeleteIncomeEvent={onDeleteIncomeEvent}
        onUpdateIncomeEvent={onUpdateIncomeEvent}
      />
    </>
  );
}
