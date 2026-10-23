import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Wallet } from "lucide-react";
import type { PaydayOutlook } from "@/domain/budget-month";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type PaydayOutlookCardProps = {
  outlook: PaydayOutlook;
  today: string;
  language: AppLanguage;
};

// "Hasta el cobro (mié 28 · 5 días): 345 €": lo que falta por pagar antes del
// próximo sueldo. Lo ya pagado no cuenta.
export function PaydayOutlookCard({ outlook, today, language }: PaydayOutlookCardProps) {
  const sameMonth = outlook.payday.slice(0, 7) === today.slice(0, 7);
  const date = format(parseISO(outlook.payday), sameMonth ? "EEE d" : "EEE d MMM", {
    locale: language === "en" ? enUS : es,
  });
  const days =
    outlook.daysUntil === 1
      ? t("monthClose.paydayDayOne", language)
      : t("monthClose.paydayDays", language).replace("{count}", String(outlook.daysUntil));
  const count = outlook.items.length;
  const detail =
    count === 0
      ? t("monthClose.paydayNothing", language)
      : count === 1
        ? t("monthClose.paydayReceiptsOne", language)
        : t("monthClose.paydayReceiptsMany", language).replace("{count}", String(count));

  return (
    <div
      className="app-plan-next-receipt mt-3 flex min-h-11 items-center gap-3 px-3 py-3"
      data-payday-outlook="true"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-accent)]">
        <Wallet size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--app-text)]">
          {t("monthClose.paydayTitle", language)
            .replace("{date}", date)
            .replace("{days}", days)}
        </p>
        <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{detail}</p>
      </div>
      <p className="app-money shrink-0 text-base font-semibold text-[var(--app-text)]">
        {formatCurrency(outlook.total)}
      </p>
    </div>
  );
}
