import { useId } from "react";
import { Check, Pencil } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { ChargeHistoryEntry, PaidAmountAverage } from "@/domain/amount-history";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatChargeDate } from "../../lib/series-format";

type ChargeHistoryCardProps = {
  entries: ChargeHistoryEntry[];
  average: PaidAmountAverage | null;
  language: AppLanguage;
  today: string;
  onPay: (occurrence: ExpenseOccurrence) => void;
};

// Previsto frente a pagado en los últimos cobros (recibos variables), con la
// media de los últimos pagos. Desde aquí se paga o se corrige lo pagado.
export function ChargeHistoryCard({
  entries,
  average,
  language,
  today,
  onPay,
}: ChargeHistoryCardProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="app-section-card mt-4 grid gap-3 p-4">
      <div className="grid gap-0.5">
        <h2 id={titleId} className="text-base font-semibold text-[var(--app-text)]">
          {t("bills.historyTitle", language)}
        </h2>
        {average && average.count > 1 ? (
          <p className="app-money text-xs text-[var(--app-text-muted)]">
            {t("bills.historyAverage", language)
              .replace("{count}", String(average.count))
              .replace("{amount}", formatCurrency(average.amount))}
          </p>
        ) : null}
      </div>

      {entries.length ? (
        <ul className="grid gap-2">
          {entries.map((entry) => (
            <ChargeRow
              key={entry.occurrence.id}
              entry={entry}
              language={language}
              today={today}
              onPay={onPay}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--app-text-muted)]">{t("bills.historyEmpty", language)}</p>
      )}
    </section>
  );
}

function ChargeRow({
  entry,
  language,
  today,
  onPay,
}: {
  entry: ChargeHistoryEntry;
  language: AppLanguage;
  today: string;
  onPay: (occurrence: ExpenseOccurrence) => void;
}) {
  const { occurrence, planned, paid, difference } = entry;
  const date = formatChargeDate(occurrence.dueDate, language, today);
  const status =
    occurrence.status === "paid"
      ? t("bills.chargePaid", language)
      : occurrence.status === "skipped"
        ? t("bills.chargeSkipped", language)
        : t("bills.chargePending", language);
  const detail =
    paid !== null && difference !== 0
      ? `${status} · ${t("bills.historyPlanned", language).replace("{amount}", formatCurrency(planned))}`
      : status;
  const actionLabel = (
    paid !== null ? t("bills.historyEditPaid", language) : t("bills.historyPay", language)
  ).replace("{date}", date);

  return (
    <li className="app-list-item grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-1.5 pl-3 pr-1">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--app-text)]">{date}</p>
        <p className="app-money break-words text-xs text-[var(--app-text-muted)]">{detail}</p>
      </div>
      <div className="text-right">
        <p
          className={`app-money text-sm font-semibold ${
            occurrence.status === "skipped"
              ? "text-[var(--app-text-subtle)] line-through"
              : "text-[var(--app-text)]"
          }`}
        >
          {formatCurrency(paid ?? planned)}
        </p>
        {difference !== 0 ? (
          <p
            className={`app-money text-xs font-semibold ${
              difference > 0 ? "text-[var(--app-warning)]" : "text-[var(--app-success)]"
            }`}
          >
            {difference > 0 ? "+" : "−"}
            {formatCurrency(Math.abs(difference))}
          </p>
        ) : null}
      </div>
      {occurrence.status === "skipped" ? (
        <span className="size-11" aria-hidden="true" />
      ) : (
        <IconButton
          type="button"
          variant="ghost"
          size="touch"
          aria-label={actionLabel}
          title={actionLabel}
          onClick={() => onPay(occurrence)}
        >
          {paid !== null ? <Pencil size={15} /> : <Check size={16} />}
        </IconButton>
      )}
    </li>
  );
}
