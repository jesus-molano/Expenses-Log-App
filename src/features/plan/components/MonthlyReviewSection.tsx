import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PaidAmountAverage } from "@/domain/amount-history";
import { formatCurrency } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
  IncomeEvent,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import type {
  IncomeEventInput,
  MonthlyExpenseOverrideInput,
} from "@/stores/app/store-types";
import { phaseLabel } from "../lib/plan-dashboard";
import type { MoneySeriesItem } from "../types";
import { MonthlyExpenseBreakdown } from "./MonthlyExpenseBreakdown";
import { MonthlyIncomeEventsList } from "./MonthlyIncomeEventsList";

export function MonthlyReviewSection({
  language,
  reviewYear,
  availableYears,
  selectedSummary,
  reviewMoneySeries,
  selectedHasLegacyHistory,
  previousSummary,
  selectedIncomeEvents,
  selectedOccurrences,
  visibleSelectedOccurrences,
  categories,
  todayDateOnly,
  expandedReview,
  onYearChange,
  onMonthChange,
  onEditSalary,
  onEditSavings,
  onOpenSummary,
  onDeleteIncomeEvent,
  onUpdateIncomeEvent,
  onToggleExpanded,
  onSkipOccurrence,
  onTogglePaid,
  onUpdateMonthlyExpense,
  suggestPaidAmount,
}: {
  language: AppLanguage;
  reviewYear: number;
  availableYears: number[];
  selectedSummary: MoneySeriesItem;
  reviewMoneySeries: MoneySeriesItem[];
  selectedHasLegacyHistory: boolean;
  previousSummary: MoneySeriesItem;
  selectedIncomeEvents: IncomeEvent[];
  selectedOccurrences: ExpenseOccurrence[];
  visibleSelectedOccurrences: ExpenseOccurrence[];
  categories: ExpenseCategory[];
  todayDateOnly: string;
  expandedReview: boolean;
  onYearChange: (year: number) => void;
  onMonthChange: (monthId: string) => void;
  onEditSalary: () => void;
  onEditSavings: () => void;
  // Abre "Resumen de <mes>" del mes elegido.
  onOpenSummary: () => void;
  onDeleteIncomeEvent: (id: string) => void;
  onUpdateIncomeEvent: (id: string, input: IncomeEventInput) => void;
  onToggleExpanded: () => void;
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onUpdateMonthlyExpense: (input: MonthlyExpenseOverrideInput) => void;
  suggestPaidAmount?: (occurrence: ExpenseOccurrence) => PaidAmountAverage | null;
}) {
  // M17: en un mes registrado el libre solo resta el ahorro real; si había
  // objetivo y no se apuntó nada, se avisa y se ofrece registrarlo.
  const goalNotRegistered =
    selectedSummary.phase === "registered" &&
    (selectedSummary.savingsGoal ?? 0) > 0 &&
    selectedSummary.savings === 0;

  return (
    <section className="min-w-0" aria-labelledby="monthly-review-title">
      <header className="px-1">
        <h2
          id="monthly-review-title"
          className="app-plan-section-title text-[var(--app-text)]"
        >
          {t("plan.monthlyReview", language)}
        </h2>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {t("plan.comparedWithPrevious", language)}
        </p>
      </header>
      <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-3">
        <select
          value={reviewYear}
          onChange={(event) => onYearChange(Number(event.target.value))}
          aria-label={t("money.year", language)}
          className="input-control"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          value={selectedSummary.id}
          onChange={(event) => onMonthChange(event.target.value)}
          aria-label={t("money.month", language)}
          className="input-control capitalize"
        >
          {reviewMoneySeries.map((item) => (
            <option key={item.id} value={item.id}>
              {item.monthLong}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 px-1 text-xs font-semibold">
        <span className="rounded-full bg-[var(--app-panel-soft-alpha)] px-2.5 py-1 text-[var(--app-text-muted)]">
          {phaseLabel(selectedSummary.phase, language)}
        </span>
        {selectedHasLegacyHistory ? (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--app-warning)_12%,transparent)] px-2.5 py-1 text-[var(--app-warning)]">
            {t("plan.legacyDerived", language)}
          </span>
        ) : null}
      </div>

      <dl className="app-plan-review-summary mt-5 grid gap-1 rounded-[var(--app-radius-lg)] p-2">
        <ReviewDelta
          label={t("plan.recurringExpenses", language)}
          value={selectedSummary.expenses}
          previous={previousSummary.expenses}
        />
        <ReviewDelta
          label={t("plan.paid", language)}
          value={selectedSummary.paid ?? 0}
          previous={previousSummary.paid ?? 0}
        />
        <ReviewDelta
          label={t("plan.actualSavings", language)}
          value={selectedSummary.savings}
          previous={previousSummary.savings}
        />
        <ReviewDelta
          label={t("plan.freeAccordingToPlan", language)}
          value={selectedSummary.remaining}
          previous={previousSummary.remaining}
        />
      </dl>

      {goalNotRegistered ? (
        <div className="mt-3 grid gap-2 rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-warning)_10%,transparent)] px-3 py-3">
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
          <Button size="sm" variant="secondary" className="justify-self-start" onClick={onEditSavings}>
            {t("monthClose.registerSavings", language)}
          </Button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onOpenSummary}>
          {t("insights.summary.open", language)}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEditSalary}>
          {t("plan.editFixedIncome", language)}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEditSavings}>
          {t("plan.editSavings", language)}
        </Button>
      </div>

      <div className="mt-6 grid gap-6">
        <MonthlyIncomeEventsList
          language={language}
          incomeEvents={selectedIncomeEvents}
          onDeleteIncomeEvent={onDeleteIncomeEvent}
          onUpdateIncomeEvent={onUpdateIncomeEvent}
        />
        <MonthlyExpenseBreakdown
          language={language}
          today={todayDateOnly}
          occurrences={selectedOccurrences}
          visibleOccurrences={visibleSelectedOccurrences}
          categories={categories}
          expanded={expandedReview}
          onToggleExpanded={onToggleExpanded}
          onSkipOccurrence={onSkipOccurrence}
          onTogglePaid={onTogglePaid}
          onUpdateMonthlyExpense={onUpdateMonthlyExpense}
          suggestPaidAmount={suggestPaidAmount}
        />
      </div>
    </section>
  );
}

function ReviewDelta({
  label,
  value,
  previous,
}: {
  label: string;
  value: number;
  previous: number;
}) {
  const delta = value - previous;
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--app-radius-sm)] px-2 py-2.5">
      <dt className="text-sm font-medium text-[var(--app-text)]">{label}</dt>
      <dd className="text-right">
        <span className="app-money block font-semibold text-[var(--app-text)]">
          {formatCurrency(value)}
        </span>
        <span className="app-money mt-0.5 block text-xs text-[var(--app-text-muted)]">
          {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
          {formatCurrency(Math.abs(delta))}
        </span>
      </dd>
    </div>
  );
}
