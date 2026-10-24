import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, MonthlyMoneyPlan } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";

// "Resumen del mes": ingresos menos recibos menos ahorro es lo libre según el
// plan. Los ingresos se cambian desde su fila ("Base del plan").
export function MonthEquationSection({
  plan,
  language,
  onChangeIncome,
}: {
  plan: MonthlyMoneyPlan;
  language: AppLanguage;
  onChangeIncome: () => void;
}) {
  return (
    <section aria-labelledby="monthly-equation-title" className="min-w-0">
      <h2
        id="monthly-equation-title"
        className="app-plan-group-title px-1 text-[var(--app-text)]"
      >
        {t("plan.monthEquation", language)}
      </h2>
      <dl className="app-plan-equation mt-3 grid gap-1 p-2 sm:p-3">
        <EquationRow
          label={t("plan.expectedIncome", language)}
          detail={incomeDetail(plan, language)}
          value={plan.plannedIncomeTotal}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mt-1"
              aria-label={t("plan.changeBaseLabel", language)}
              onClick={onChangeIncome}
            >
              {t("plan.changeBase", language)}
            </Button>
          }
        />
        <EquationRow
          label={t("plan.expectedFinalExpenses", language)}
          detail={formatMessage(
            "plan.expensesDetail",
            {
              paid: formatCurrency(plan.paidExpensesTotal),
              pending: formatCurrency(plan.pendingExpensesTotal),
            },
            language,
          )}
          value={-plan.expectedExpensesTotal}
        />
        <EquationRow
          label={t("plan.reservedSavings", language)}
          detail={formatMessage(
            "plan.savingsDetail",
            {
              goal: formatCurrency(plan.savingsTarget),
              actual: formatCurrency(plan.savingsActual),
            },
            language,
          )}
          value={-plan.savingsReserved}
        />
        <div className="app-plan-equation-total mt-1 flex items-end justify-between gap-4 rounded-[var(--app-radius-md)] px-3 py-3">
          <div className="min-w-0">
            <dt className="font-semibold text-[var(--app-text)]">
              {t("plan.freeAccordingToPlan", language)}
            </dt>
            <dd className="mt-1 max-w-lg text-xs leading-relaxed text-[var(--app-text-muted)]">
              {t("plan.freeDisclaimer", language)}
            </dd>
          </div>
          <dd className="app-money shrink-0 text-xl font-semibold text-[var(--app-accent)]">
            {formatCurrency(plan.freeAccordingToPlan)}
          </dd>
        </div>
      </dl>
      {plan.billsShortfall > 0 || plan.savingsGoalShortfall > 0 ? (
        <div className="mt-3 flex gap-2 px-1 text-sm text-[var(--app-warning)]">
          <TriangleAlert className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          <p>
            {plan.billsShortfall > 0
              ? formatMessage(
                  "plan.missingForReceipts",
                  { amount: formatCurrency(plan.billsShortfall) },
                  language,
                )
              : formatMessage(
                  "plan.unfundedGoal",
                  { amount: formatCurrency(plan.savingsGoalShortfall) },
                  language,
                )}
          </p>
        </div>
      ) : null}
    </section>
  );
}

// Ingresos del mes: el sueldo cobrado si ya se confirmó; si no, el fijo (con
// la paga extra aparte si toca). Después, los extras.
function incomeDetail(plan: MonthlyMoneyPlan, language: AppLanguage) {
  const extras = formatCurrency(plan.extraIncomeTotal);
  if (plan.salaryReceipt) {
    return formatMessage(
      "plan.incomeDetailReceived",
      { received: formatCurrency(plan.salaryReceipt.amount), extras },
      language,
    );
  }
  if (plan.salaryExtraPayTotal > 0) {
    return formatMessage(
      "plan.incomeDetailExtraPay",
      {
        fixed: formatCurrency(plan.fixedIncomeTotal - plan.salaryExtraPayTotal),
        extraPay: formatCurrency(plan.salaryExtraPayTotal),
        extras,
      },
      language,
    );
  }
  return formatMessage(
    "plan.incomeDetail",
    { fixed: formatCurrency(plan.fixedIncomeTotal), extras },
    language,
  );
}

function EquationRow({
  label,
  detail,
  value,
  action,
}: {
  label: string;
  detail: string;
  value: number;
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex justify-between gap-4 rounded-[var(--app-radius-sm)] px-3 py-2.5 ${
        action ? "items-start" : "items-center"
      }`}
    >
      <div className="min-w-0">
        <dt className="break-words font-medium text-[var(--app-text)]">{label}</dt>
        <dd className="mt-1 break-words text-xs text-[var(--app-text-muted)]">{detail}</dd>
        {action ? <dd>{action}</dd> : null}
      </div>
      <dd className="app-money shrink-0 font-semibold text-[var(--app-text)]">
        {value < 0 ? "−" : ""}
        {formatCurrency(Math.abs(value))}
      </dd>
    </div>
  );
}
