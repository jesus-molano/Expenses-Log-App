"use client";

import { X } from "lucide-react";
import { useId, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseCategory, MonthlyMoneyPlan } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMoneyInput } from "@/shared/money";
import type { LeftoverRow } from "../../lib/month-close";
import { capitalize, formatMonthName } from "../../lib/month-view";
import { MonthCloseLeftoverRow } from "./MonthCloseLeftoverRow";
import { MonthCloseStep } from "./MonthCloseStep";
import { MonthCloseSummary } from "./MonthCloseSummary";

type MonthCloseSheetProps = {
  monthId: string;
  nextMonthId: string;
  plan: MonthlyMoneyPlan;
  rows: LeftoverRow[];
  categories: ExpenseCategory[];
  today: string;
  language: AppLanguage;
  savingsText: string;
  savingsTarget: number;
  savingsInvalid: boolean;
  onSavingsChange: (value: string) => void;
  onClose: () => void;
  onPay: (row: LeftoverRow) => void;
  onSkip: (row: LeftoverRow) => void;
  onMove: (row: LeftoverRow) => void;
  onUndo: (row: LeftoverRow) => void;
  onPayAll: () => void;
  onStart: () => void;
};

// Cierre del mes cuando quedan recibos tras el cobro: 1) resumen frente al
// plan, 2) qué pasó con cada resto, 3) ahorro real del mes y 4) empezar el
// siguiente.
export function MonthCloseSheet({
  monthId,
  nextMonthId,
  plan,
  rows,
  categories,
  today,
  language,
  savingsText,
  savingsTarget,
  savingsInvalid,
  onSavingsChange,
  onClose,
  onPay,
  onSkip,
  onMove,
  onUndo,
  onPayAll,
  onStart,
}: MonthCloseSheetProps) {
  const titleId = useId();
  const savingsId = useId();
  const savingsErrorId = useId();
  const month = formatMonthName(monthId, language);
  const nextMonth = formatMonthName(nextMonthId, language);
  const pendingCount = rows.filter((row) => row.resolution === "pending").length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart();
  }

  return (
    <Sheet ariaLabelledBy={titleId} onBackdropClick={onClose}>
      <form onSubmit={submit} className="contents">
        <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
          <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-[var(--app-text)]">
                {capitalize(t("monthClose.closeMonth", language).replace("{month}", month))}
              </h2>
              <p className="truncate text-sm text-[var(--app-text-muted)]">
                {t("monthClose.sheetSubtitle", language)
                  .replace("{month}", month)
                  .replace("{next}", nextMonth)}
              </p>
            </div>
            <IconButton
              type="button"
              onClick={onClose}
              aria-label={t("expenses.close", language)}
              className="shrink-0"
            >
              <X size={18} />
            </IconButton>
          </header>
        </div>

        <div className="grid gap-6 px-5 pb-5 pt-2">
          <MonthCloseStep number={1} title={t("monthClose.stepSummary", language)}>
            <MonthCloseSummary plan={plan} language={language} />
          </MonthCloseStep>

          <MonthCloseStep
            number={2}
            title={t("monthClose.stepLeftovers", language)}
            action={
              pendingCount > 1 ? (
                <Button size="sm" variant="ghost" onClick={onPayAll}>
                  {t("monthClose.payAll", language)}
                </Button>
              ) : null
            }
          >
            <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">
              {pendingCount > 0
                ? t("monthClose.leftoversHint", language).replace("{month}", month)
                : t("monthClose.leftoversDone", language).replace("{month}", month)}
            </p>
            <ul className="grid gap-2">
              {rows.map((row) => (
                <MonthCloseLeftoverRow
                  key={row.snapshot.id}
                  row={row}
                  nextMonthName={nextMonth}
                  categories={categories}
                  today={today}
                  language={language}
                  onPay={() => onPay(row)}
                  onSkip={() => onSkip(row)}
                  onMove={() => onMove(row)}
                  onUndo={() => onUndo(row)}
                />
              ))}
            </ul>
          </MonthCloseStep>

          <MonthCloseStep
            number={3}
            title={t("monthClose.stepSavings", language).replace("{month}", month)}
          >
            <div className="grid gap-1.5">
              <label
                htmlFor={savingsId}
                className="text-xs font-semibold text-[var(--app-text-muted)]"
              >
                {t("monthClose.savingsLabel", language).replace("{month}", month)}
              </label>
              <MoneyInput
                id={savingsId}
                value={savingsText}
                allowZero
                blockSubmit={false}
                onValueChange={onSavingsChange}
                invalidMessage={t("money.amountInvalid", language)}
                aria-describedby={savingsErrorId}
                placeholder={formatMoneyInput(savingsTarget, language)}
              />
              <p
                id={savingsErrorId}
                className={`text-xs leading-relaxed ${
                  savingsInvalid ? "text-[var(--app-warning)]" : "text-[var(--app-text-muted)]"
                }`}
                aria-live="polite"
              >
                {savingsInvalid
                  ? t("money.amountInvalid", language)
                  : savingsTarget > 0
                    ? t("monthClose.savingsHint", language).replace(
                        "{target}",
                        formatCurrency(savingsTarget),
                      )
                    : t("monthClose.savingsHintNoGoal", language)}
              </p>
            </div>
          </MonthCloseStep>

          <div className="app-sheet-footer sticky bottom-0 -mx-5 grid gap-1.5 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              leadingIcon={
                <span
                  aria-hidden="true"
                  className="grid size-6 place-items-center rounded-full bg-[color-mix(in_srgb,var(--app-accent-contrast)_18%,transparent)] text-xs"
                >
                  4
                </span>
              }
            >
              {capitalize(t("monthClose.startMonth", language).replace("{month}", nextMonth))}
            </Button>
            <p className="text-center text-xs text-[var(--app-text-muted)]">
              {t("monthClose.startMonthHint", language).replace("{month}", month)}
            </p>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
