"use client";

import { ChevronDown, ReceiptText } from "lucide-react";
import { useId } from "react";
import type { PaidAmountAverage } from "@/domain/amount-history";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
  MonthlyMoneyPlan,
} from "@/domain/types";
import { formatMonthName } from "@/features/expenses/lib/month-view";
import { formatMessage, t } from "@/shared/i18n";
import type { MonthlyExpenseOverrideInput } from "@/stores/app/store-types";
import { monthReceiptsSummary } from "../lib/month-receipts";
import { MonthlyExpenseBreakdown } from "./MonthlyExpenseBreakdown";

// "Recibos de <mes>", plegada de entrada: cuántos quedan y cuánto, y al
// abrirla los recibos con los pendientes primero para pagarlos, corregir lo
// pagado o quitarlos del mes.
export function MonthReceiptsList({
  monthId,
  receipts,
  pendingCount,
  plan,
  open,
  categories,
  today,
  language,
  onToggle,
  onSkipOccurrence,
  onTogglePaid,
  onUpdateMonthlyExpense,
  suggestPaidAmount,
}: {
  monthId: string;
  // Sin los quitados del mes y con los pendientes primero (`monthReceipts`).
  receipts: ExpenseOccurrence[];
  pendingCount: number;
  plan: Pick<
    MonthlyMoneyPlan,
    "plannedExpenseCount" | "paidExpenseCount" | "pendingExpensesTotal" | "paidExpensesTotal"
  >;
  open: boolean;
  categories: ExpenseCategory[];
  today: string;
  language: AppLanguage;
  onToggle: () => void;
  onSkipOccurrence: (occurrence: ExpenseOccurrence) => void;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
  onUpdateMonthlyExpense: (input: MonthlyExpenseOverrideInput) => void;
  suggestPaidAmount?: (occurrence: ExpenseOccurrence) => PaidAmountAverage | null;
}) {
  const titleId = useId();
  const listId = useId();
  const paidProgress = plan.plannedExpenseCount
    ? Math.round((plan.paidExpenseCount / plan.plannedExpenseCount) * 100)
    : 0;

  return (
    <section className="min-w-0" aria-labelledby={titleId}>
      <div className="app-plan-actions rounded-[var(--app-radius-lg)] p-1">
        <h2>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={onToggle}
            className="app-plan-action-row app-focus-ring flex min-h-14 w-full items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-control)] text-[var(--app-accent)]">
              <ReceiptText size={17} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                id={titleId}
                className="block break-words text-sm font-semibold text-[var(--app-text)]"
              >
                {formatMessage(
                  "plan.receiptsFor",
                  { month: formatMonthName(monthId, language) },
                  language,
                )}
              </span>
              <span className="app-money mt-0.5 block break-words text-xs text-[var(--app-text-muted)]">
                {monthReceiptsSummary(pendingCount, plan, language)}
              </span>
            </span>
            <ChevronDown
              size={17}
              aria-hidden="true"
              className={`shrink-0 text-[var(--app-text-muted)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </h2>
        {plan.plannedExpenseCount ? (
          <div
            className="mx-3 mb-2 mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--app-control)]"
            role="progressbar"
            aria-label={t("plan.paidProgress", language)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={paidProgress}
            aria-valuetext={formatMessage(
              "plan.paidReceiptsProgress",
              { paid: plan.paidExpenseCount, total: plan.plannedExpenseCount },
              language,
            )}
          >
            <div
              className="h-full rounded-full bg-[var(--app-success)] transition-[width]"
              style={{ width: `${paidProgress}%` }}
            />
          </div>
        ) : null}
      </div>
      <div id={listId} hidden={!open} className="mt-3">
        {open ? (
          <MonthlyExpenseBreakdown
            language={language}
            today={today}
            occurrences={receipts}
            categories={categories}
            onSkipOccurrence={onSkipOccurrence}
            onTogglePaid={onTogglePaid}
            onUpdateMonthlyExpense={onUpdateMonthlyExpense}
            suggestPaidAmount={suggestPaidAmount}
          />
        ) : null}
      </div>
    </section>
  );
}
