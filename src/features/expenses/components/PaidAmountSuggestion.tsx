import { Sparkles } from "lucide-react";
import type { PaidAmountAverage } from "@/domain/amount-history";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatMoneyInput } from "@/shared/money";
import { paidAmountSuggestionLabel } from "../lib/series-format";

type PaidAmountSuggestionProps = {
  suggestion: PaidAmountAverage;
  language: AppLanguage;
  onUse: (amountText: string) => void;
};

// Sugerencia para un recibo variable: la media de los últimos pagos. Al
// tocarla rellena el importe.
export function PaidAmountSuggestion({ suggestion, language, onUse }: PaidAmountSuggestionProps) {
  const label = paidAmountSuggestionLabel(suggestion, language);
  return (
    <button
      type="button"
      onClick={() => onUse(formatMoneyInput(suggestion.amount, language))}
      aria-label={`${label}. ${t("bills.useSuggestion", language).replace(
        "{amount}",
        formatCurrency(suggestion.amount),
      )}`}
      className="app-chip app-focus-ring inline-flex min-h-11 items-center gap-2 justify-self-start px-3 text-left text-sm font-semibold"
    >
      <Sparkles size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
