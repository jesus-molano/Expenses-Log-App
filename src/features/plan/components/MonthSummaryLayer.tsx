"use client";

import { activeBudgetMonth } from "@/domain/budget-month";
import type { AppLanguage } from "@/domain/types";
import { formatMonthName, periodRangeLabel } from "@/features/expenses/lib/month-view";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useIncomeRemovalConfirmation } from "../hooks/use-income-removal-confirmation";
import { useMonthSummary } from "../hooks/use-month-summary";
import { useMonthlySalaryEditor } from "../hooks/use-monthly-salary-editor";
import { useSavingsContributionEditor } from "../hooks/use-savings-contribution-editor";
import { incomeEventsInMonth } from "../lib/plan-dashboard";
import { MonthlySalaryDialog } from "./MonthlySalaryDialog";
import { MonthSummarySheet } from "./MonthSummarySheet";
import { RemoveIncomeDialog } from "./RemoveIncomeDialog";
import { SavingsContributionSheet } from "./SavingsContributionSheet";

// "Resumen de <mes>" con sus acciones de revisión y las hojas que abren
// encima (sueldo del mes, ahorro, quitar un ingreso). Es la misma hoja desde
// "Ver resumen" en Gastos y desde la fila del resumen en Mes.
export function MonthSummaryLayer({
  monthId,
  today,
  language,
  onClose,
}: {
  monthId: string;
  // YYYY-MM-DD
  today: string;
  language: AppLanguage;
  onClose: () => void;
}) {
  const {
    store,
    updateMonthlySalary,
    updateMonthlySavingsContribution,
    deleteIncomeEvent,
    updateIncomeEvent,
  } = useExpenseStore();
  const summary = useMonthSummary({ store, monthId, today, language });
  const active = activeBudgetMonth(store.finance, today);
  const salaryEditor = useMonthlySalaryEditor({
    finance: store.finance,
    language,
    monthId,
    monthLabel: formatMonthName(monthId, language, { withYear: true }),
    activeMonthId: active.monthId,
    onSave: updateMonthlySalary,
  });
  const savingsEditor = useSavingsContributionEditor({
    finance: store.finance,
    language,
    onSave: updateMonthlySavingsContribution,
  });
  const incomeRemoval = useIncomeRemovalConfirmation(
    store.finance.incomeEvents,
    deleteIncomeEvent,
  );

  return (
    <>
      <MonthSummarySheet
        summary={summary}
        language={language}
        periodLabel={periodRangeLabel(monthId, active.cycle, language)}
        review={{
          incomeEvents: incomeEventsInMonth(store.finance, monthId, active.cycle),
          onEditSalary: salaryEditor.openEditor,
          onEditSavings: () => savingsEditor.open(monthId),
          onDeleteIncomeEvent: incomeRemoval.requestRemoval,
          onUpdateIncomeEvent: updateIncomeEvent,
        }}
        onClose={onClose}
      />

      <SavingsContributionSheet editor={savingsEditor} language={language} />

      {salaryEditor.open ? (
        <MonthlySalaryDialog
          language={language}
          monthLabel={salaryEditor.monthLabel}
          amount={salaryEditor.amount}
          salaryDay={salaryEditor.salaryDay}
          dayPickerOpen={salaryEditor.dayPickerOpen}
          scope={salaryEditor.scope}
          onScopeChange={salaryEditor.setScope}
          onAmountChange={salaryEditor.setAmount}
          onSalaryDayChange={salaryEditor.setSalaryDay}
          onDayPickerOpenChange={salaryEditor.setDayPickerOpen}
          onClose={salaryEditor.closeEditor}
          onSubmit={salaryEditor.submit}
        />
      ) : null}

      <RemoveIncomeDialog
        incomeEvent={incomeRemoval.incomeToRemove}
        language={language}
        onCancel={incomeRemoval.cancelRemoval}
        onConfirm={incomeRemoval.confirmRemoval}
      />
    </>
  );
}
