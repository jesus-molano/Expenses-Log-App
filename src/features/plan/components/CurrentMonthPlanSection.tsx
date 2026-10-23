import type { ReactNode } from "react";
import {
  CalendarClock,
  ChevronRight,
  Plus,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { PaydayOutlook } from "@/domain/budget-month";
import { formatCurrency } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
  MonthlyMoneyPlan,
} from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import type { MonthlyExpenseOverrideInput } from "@/stores/app/store-types";
import { formatShortDate } from "../lib/plan-dashboard";
import { MonthlyExpenseRow } from "./MonthlyExpenseRow";
import { PaydayOutlookCard } from "./PaydayOutlookCard";

export function CurrentMonthPlanSection({
  language,
  monthLabel,
  phaseLabel = null,
  savingsLabel,
  paydayOutlook = null,
  plan,
  paidProgress,
  pendingOccurrences,
  categories,
  todayDateOnly,
  onOpenSettings,
  onOpenSavings,
  onOpenExtraIncome,
  onSkipOccurrence,
  onTogglePaid,
  onUpdateMonthlyExpense,
}: {
  language: AppLanguage;
  monthLabel: string;
  // Fase del mes que se mira cuando no es el activo ("Registrado", "Proyectado").
  phaseLabel?: string | null;
  savingsLabel: string;
  // "Hasta el cobro", solo en el mes activo y con sueldo configurado.
  paydayOutlook?: PaydayOutlook | null;
  plan: MonthlyMoneyPlan;
  paidProgress: number;
  pendingOccurrences: ExpenseOccurrence[];
  categories: ExpenseCategory[];
  todayDateOnly: string;
  onOpenSettings: () => void;
  onOpenSavings: () => void;
  onOpenExtraIncome: () => void;
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onUpdateMonthlyExpense: (input: MonthlyExpenseOverrideInput) => void;
}) {
  return (
    <section className="min-w-0" aria-labelledby="current-month-title">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1
            id="current-month-title"
            className="app-plan-page-title text-[var(--app-text)]"
          >
            {formatMessage("plan.planFor", { month: monthLabel }, language)}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--app-text-muted)]">
            {phaseLabel ? (
              <span className="rounded-full bg-[var(--app-panel-soft-alpha)] px-2.5 py-0.5 text-xs font-semibold">
                {phaseLabel}
              </span>
            ) : null}
            <span>
              {plan.plannedExpenseCount
                ? formatMessage(
                    "plan.paidReceiptsProgress",
                    { paid: plan.paidExpenseCount, total: plan.plannedExpenseCount },
                    language,
                  )
                : t("plan.noReceipts", language)}
            </span>
          </p>
        </div>
        <IconButton
          type="button"
          onClick={onOpenSettings}
          aria-label={t("money.configure", language)}
          title={t("money.configure", language)}
        >
          <Settings2 size={17} />
        </IconButton>
      </header>

      {plan.plannedExpenseCount ? (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--app-control)]"
          role="progressbar"
          aria-label={t("plan.paidProgress", language)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={paidProgress}
        >
          <div
            className="h-full rounded-full bg-[var(--app-success)] transition-[width]"
            style={{ width: `${paidProgress}%` }}
          />
        </div>
      ) : null}

      <div className="app-plan-next-receipt mt-5 flex min-h-11 items-center gap-3 px-3 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-accent)]">
          <CalendarClock size={17} />
        </span>
        <div className="min-w-0 flex-1">
          {plan.nextPending ? (
            <>
              <p className="break-words text-sm font-semibold text-[var(--app-text)]">
                {plan.nextPending.overdue ? t("plan.overdue", language) : t("plan.nextReceipt", language)}: {plan.nextPending.name}
              </p>
              <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                <span className="app-money">
                  {formatShortDate(plan.nextPending.dueDate, language)} · {formatCurrency(plan.nextPending.amount)}
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--app-success)]">
              {plan.plannedExpenseCount ? t("plan.allPaid", language) : t("plan.noUpcomingReceipt", language)}
            </p>
          )}
        </div>
      </div>

      {paydayOutlook ? (
        <PaydayOutlookCard
          outlook={paydayOutlook}
          today={todayDateOnly}
          language={language}
        />
      ) : null}

      <div className="mt-10 grid gap-10 sm:mt-12 sm:gap-12">
        <section
          aria-labelledby="monthly-equation-title"
          className="min-w-0 px-1"
        >
          <h2
            id="monthly-equation-title"
            className="app-plan-group-title text-[var(--app-text)]"
          >
            {t("plan.monthEquation", language)}
          </h2>
          <dl className="app-plan-equation mt-5 grid gap-1 p-2 sm:p-3">
            <EquationRow
              label={t("plan.expectedIncome", language)}
              detail={formatMessage(
                "plan.incomeDetail",
                {
                  fixed: formatCurrency(plan.fixedIncomeTotal),
                  extras: formatCurrency(plan.extraIncomeTotal),
                },
                language,
              )}
              value={plan.plannedIncomeTotal}
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
            <div className="mt-3 flex gap-2 text-sm text-[var(--app-warning)]">
              <TriangleAlert className="mt-0.5 shrink-0" size={16} />
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

        <div className="app-plan-actions grid gap-1 rounded-[var(--app-radius-lg)] p-1">
          <button
            type="button"
            onClick={onOpenSavings}
            className="app-plan-savings-action app-focus-ring flex min-h-14 w-full items-center justify-between gap-4 rounded-[var(--app-radius-md)] px-3 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-[var(--app-text)] first-letter:uppercase">
                {savingsLabel}
              </span>
              <span className="mt-1 block text-sm text-[var(--app-text-muted)]">
                {formatMessage(
                  "plan.savingsActionDetail",
                  {
                    actual: formatCurrency(plan.savingsActual),
                    goal: formatCurrency(plan.savingsTarget),
                  },
                  language,
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="app-money font-semibold text-[var(--app-success)]">
                {formatCurrency(plan.savingsActual)}
              </span>
              <ChevronRight
                size={17}
                className="text-[var(--app-text-muted)]"
              />
            </span>
          </button>

          <PlanAction
            icon={<Plus size={17} />}
            label={t("plan.extraIncome", language)}
            detail={formatCurrency(plan.extraIncomeTotal)}
            onClick={onOpenExtraIncome}
          />
        </div>

        <section className="min-w-0" aria-labelledby="pending-receipts-title">
          <header className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2
                id="pending-receipts-title"
                className="app-plan-group-title text-[var(--app-text)]"
              >
                {t("plan.pendingReceipts", language)}
              </h2>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                {pendingOccurrences.length} · {formatCurrency(plan.pendingExpensesTotal)}
              </p>
            </div>
          </header>
          <div className="app-monthly-table mt-3" data-tone="expense">
            <div
              className="app-monthly-table-body"
              data-integrated-list="true"
            >
              {pendingOccurrences.length ? (
                pendingOccurrences.map((occurrence) => (
                  <MonthlyExpenseRow
                    key={occurrence.id}
                    occurrence={occurrence}
                    categories={categories}
                    language={language}
                    today={todayDateOnly}
                    skipLabel={t("money.skipMonthExpense", language)}
                    onSkip={() => onSkipOccurrence(occurrence)}
                    onTogglePaid={() => onTogglePaid(occurrence)}
                    onUpdate={onUpdateMonthlyExpense}
                  />
                ))
              ) : (
                <p className="px-3 py-4 text-sm font-medium text-[var(--app-text-muted)]">
                  {plan.plannedExpenseCount ? t("plan.allPaid", language) : t("plan.noReceipts", language)}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function EquationRow({
  label,
  detail,
  value,
}: {
  label: string;
  detail: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--app-radius-sm)] px-3 py-2.5">
      <div className="min-w-0">
        <dt className="break-words font-medium text-[var(--app-text)]">
          {label}
        </dt>
        <dd className="mt-1 break-words text-xs text-[var(--app-text-muted)]">
          {detail}
        </dd>
      </div>
      <dd className="app-money shrink-0 font-semibold text-[var(--app-text)]">
        {value < 0 ? "−" : ""}
        {formatCurrency(Math.abs(value))}
      </dd>
    </div>
  );
}

function PlanAction({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-plan-action-row app-focus-ring flex min-h-14 w-full items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2 text-left"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-control)] text-[var(--app-accent)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold text-[var(--app-text)]">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">
          {detail}
        </span>
      </span>
      <ChevronRight
        size={17}
        className="shrink-0 text-[var(--app-text-muted)]"
      />
    </button>
  );
}
