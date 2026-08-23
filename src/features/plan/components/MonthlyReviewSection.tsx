import { Button } from "@/components/ui/Button";
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
import { phaseLabel, planCopy } from "../lib/plan-dashboard";
import type { MoneySeriesItem } from "../types";
import { MonthlyExpenseBreakdown } from "./MonthlyExpenseBreakdown";
import { MonthlyIncomeEventsList } from "./MonthlyIncomeEventsList";

export function MonthlyReviewSection({
  language,
  copy,
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
  onDeleteIncomeEvent,
  onUpdateIncomeEvent,
  onToggleExpanded,
  onSkipOccurrence,
  onUpdateMonthlyExpense,
}: {
  language: AppLanguage;
  copy: ReturnType<typeof planCopy>;
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
  onDeleteIncomeEvent: (id: string) => void;
  onUpdateIncomeEvent: (id: string, input: IncomeEventInput) => void;
  onToggleExpanded: () => void;
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void;
  onUpdateMonthlyExpense: (input: MonthlyExpenseOverrideInput) => void;
}) {
  return (
    <section className="min-w-0" aria-labelledby="monthly-review-title">
      <header className="px-1">
        <h2
          id="monthly-review-title"
          className="app-plan-section-title text-[var(--app-text)]"
        >
          {copy.monthlyReview}
        </h2>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {copy.comparedWithPrevious}
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
          {phaseLabel(selectedSummary.phase, copy)}
        </span>
        {selectedHasLegacyHistory ? (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--app-warning)_12%,transparent)] px-2.5 py-1 text-[var(--app-warning)]">
            {copy.legacyDerived}
          </span>
        ) : null}
      </div>

      <dl className="app-plan-review-summary mt-5 grid gap-1 rounded-[var(--app-radius-lg)] p-2">
        <ReviewDelta
          label={copy.recurringExpenses}
          value={selectedSummary.expenses}
          previous={previousSummary.expenses}
        />
        <ReviewDelta
          label={copy.paid}
          value={selectedSummary.paid ?? 0}
          previous={previousSummary.paid ?? 0}
        />
        <ReviewDelta
          label={copy.actualSavings}
          value={selectedSummary.savings}
          previous={previousSummary.savings}
        />
        <ReviewDelta
          label={copy.freeAccordingToPlan}
          value={selectedSummary.remaining}
          previous={previousSummary.remaining}
        />
      </dl>

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onEditSalary}>
          {copy.editFixedIncome}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEditSavings}>
          {copy.editSavings}
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
          onUpdateMonthlyExpense={onUpdateMonthlyExpense}
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
