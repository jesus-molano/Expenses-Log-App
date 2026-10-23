"use client";

import type { FormEvent } from "react";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeading } from "@/components/ui/SheetHeading";
import type { PaidAmountAverage } from "@/domain/amount-history";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { SeriesAmountPrompt } from "../hooks/use-series-amount-prompt";
import { formatChargeDate } from "../lib/series-format";
import { PaidAmountSuggestion } from "./PaidAmountSuggestion";
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
            {suggestion ? (
              <PaidAmountSuggestion
                suggestion={suggestion}
                language={language}
                onUse={onAmountTextChange}
              />
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
