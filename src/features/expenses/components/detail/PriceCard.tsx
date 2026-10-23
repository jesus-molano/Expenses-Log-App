import { useId } from "react";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import type { PriceHistoryEntry } from "@/domain/amount-history";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseAmountChange } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatPriceMonth, priceRangeLabel } from "../../lib/series-format";

type PriceCardProps = {
  currentAmount: number;
  scheduled: ExpenseAmountChange[];
  history: PriceHistoryEntry[];
  language: AppLanguage;
  onSchedule: () => void;
  onRemove: (from: string) => void;
};

// Precio de la serie: el actual, los cambios programados (se pueden quitar) y
// los tramos de los dos últimos años.
export function PriceCard({
  currentAmount,
  scheduled,
  history,
  language,
  onSchedule,
  onRemove,
}: PriceCardProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="app-section-card mt-4 grid gap-3 p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold text-[var(--app-text)]">
          {t("bills.priceTitle", language)}
        </h2>
        <p className="app-money text-sm font-semibold text-[var(--app-text)]">
          {t("bills.priceNow", language).replace("{amount}", formatCurrency(currentAmount))}
        </p>
      </header>

      {scheduled.length ? (
        <ul className="grid gap-2">
          {scheduled.map((change) => {
            const month = formatPriceMonth(change.from, language);
            return (
              <li
                key={change.from}
                className="app-list-item grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-1 pl-3 pr-1"
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-semibold text-[var(--app-text)]">
                    {t("bills.priceScheduledFrom", language).replace("{month}", month)}
                  </span>
                  <span className="text-xs text-[var(--app-text-muted)]">
                    {t("bills.priceScheduledTag", language)}
                  </span>
                </span>
                <span className="app-money text-sm font-semibold text-[var(--app-text)]">
                  {formatCurrency(change.amount)}
                </span>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="touch"
                  aria-label={t("bills.priceRemoveLabel", language).replace("{month}", month)}
                  title={t("bills.priceRemove", language)}
                  onClick={() => onRemove(change.from)}
                >
                  <X size={16} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      ) : null}

      {history.length > 1 ? (
        <div className="grid gap-1.5">
          <h3 className="text-xs font-semibold text-[var(--app-text-muted)]">
            {t("bills.priceHistory", language)}
          </h3>
          <ul className="grid gap-1">
            {history.map((entry, index) => (
              <li
                key={entry.from}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate capitalize text-[var(--app-text-muted)]">
                  {priceRangeLabel(entry, language, index === 0)}
                </span>
                <span className="app-money shrink-0 font-semibold text-[var(--app-text)]">
                  {formatCurrency(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-[var(--app-text-muted)]">
          {t("bills.priceNoChanges", language)}
        </p>
      )}

      <Button
        type="button"
        className="justify-self-start"
        leadingIcon={<CalendarClock size={16} />}
        onClick={onSchedule}
      >
        {t("bills.priceSchedule", language)}
      </Button>
    </section>
  );
}
