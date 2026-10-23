"use client";

import type { FormEvent } from "react";
import { useId } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeading } from "@/components/ui/SheetHeading";
import type { PaidAmountAverage } from "@/domain/amount-history";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMoneyInput } from "@/shared/money";
import type { SeriesAmountPrompt } from "../hooks/use-series-amount-prompt";
import { formatChargeDate } from "../lib/series-format";
import { SeriesAmountQuestion } from "./SeriesAmountQuestion";

type PayAmountSheetProps = {
  occurrence: ExpenseOccurrence;
  amountText: string;
  suggestion: PaidAmountAverage | null;
  seriesPrompt: SeriesAmountPrompt | null;
  language: AppLanguage;
  today: string;
  onAmountTextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onApplySeries: () => void;
  onClose: () => void;
};

// Anota lo que costó de verdad un cobro, con lo previsto a la vista y la media
// de los últimos pagos como sugerencia.
export function PayAmountSheet({
  occurrence,
  amountText,
  suggestion,
  seriesPrompt,
  language,
  today,
  onAmountTextChange,
  onSubmit,
  onApplySeries,
  onClose,
}: PayAmountSheetProps) {
  const titleId = useId();
  const suggestionText = suggestion
    ? (suggestion.count === 1
        ? t("bills.payAverageOne", language)
        : t("bills.payAverageMany", language).replace("{count}", String(suggestion.count))
      ).replace("{amount}", formatCurrency(suggestion.amount))
    : null;

  return (
    <Sheet ariaLabelledBy={titleId} contentClassName="sm:max-w-sm" onBackdropClick={onClose}>
      <div className="p-5">
        <SheetHeading
          id={titleId}
          title={t("bills.payTitle", language)}
          subtitle={`${occurrence.template.name} · ${formatChargeDate(occurrence.dueDate, language, today)}`}
          closeLabel={t("common.close", language)}
          onClose={onClose}
        />

        {seriesPrompt ? (
          <div className="mt-5">
            <SeriesAmountQuestion
              prompt={seriesPrompt}
              language={language}
              onApply={onApplySeries}
              onKeep={onClose}
            />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 grid gap-3">
            <p className="text-sm text-[var(--app-text-muted)]">
              {t("bills.payPlanned", language).replace(
                "{amount}",
                formatCurrency(occurrence.template.amount),
              )}
            </p>
            <Field label={t("bills.paidAmountLabel", language)}>
              <MoneyInput
                value={amountText}
                onValueChange={onAmountTextChange}
                invalidMessage={t("bills.payInvalid", language)}
                autoFocus
              />
            </Field>
            {suggestion && suggestionText ? (
              <button
                type="button"
                onClick={() => onAmountTextChange(formatMoneyInput(suggestion.amount, language))}
                aria-label={`${suggestionText}. ${t("bills.useSuggestion", language).replace(
                  "{amount}",
                  formatCurrency(suggestion.amount),
                )}`}
                className="app-chip app-focus-ring inline-flex min-h-11 items-center gap-2 justify-self-start px-3 text-left text-sm font-semibold"
              >
                <Sparkles size={15} aria-hidden="true" />
                {suggestionText}
              </button>
            ) : null}
            <Button type="submit" variant="primary" className="mt-2 w-full">
              {t("bills.paySave", language)}
            </Button>
          </form>
        )}
      </div>
    </Sheet>
  );
}
