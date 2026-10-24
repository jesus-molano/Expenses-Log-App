import { CalendarClock, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  LARGE_BILL_MIN_AMOUNT,
  type LargeBill,
  type ProvisionPlan,
} from "../lib/bill-forecast";
import { formatDaysUntil } from "../lib/insight-format";
import { formatShortDate } from "../lib/plan-dashboard";
import { PlanEmptyLine } from "./PlanSectionList";

// Lo que viene: recibos grandes de los próximos 90 días y cuánto apartar al
// mes para los que no se pagan todos los meses.
export function UpcomingBillsSection({
  language,
  largeBills,
  largeBillsTotal,
  provision,
}: {
  language: AppLanguage;
  largeBills: LargeBill[];
  largeBillsTotal: number;
  provision: ProvisionPlan;
}) {
  return (
    <section className="min-w-0" aria-labelledby="large-bills-title">
      <header className="px-1">
        <h2 id="large-bills-title" className="app-plan-section-title text-[var(--app-text)]">
          {t("insights.largeBills.title", language)}
        </h2>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {t("insights.largeBills.subtitle", language).replace(
            "{amount}",
            formatCurrency(largeBillsTotal),
          )}
        </p>
      </header>

      <div className="mt-4">
        {largeBills.length ? (
          <ul className="app-plan-review-summary grid gap-1 rounded-[var(--app-radius-lg)] p-2">
            {largeBills.map((bill) => (
              <li
                key={bill.occurrenceId}
                className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--app-radius-sm)] px-2 py-2"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-accent)]">
                    <CalendarClock size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold text-[var(--app-text)]">
                      {bill.name}
                    </span>
                    <span className="block text-xs text-[var(--app-text-muted)]">
                      {formatShortDate(bill.chargeDate, language)} ·{" "}
                      {formatDaysUntil(bill.daysUntil, language)}
                    </span>
                  </span>
                </span>
                <span className="app-money shrink-0 font-semibold text-[var(--app-text)]">
                  {formatCurrency(bill.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <PlanEmptyLine>{t("insights.largeBills.empty", language)}</PlanEmptyLine>
        )}
        <p className="mt-2 px-1 text-xs text-[var(--app-text-muted)]">
          {t("insights.largeBills.rule", language).replace(
            "{amount}",
            formatCurrency(LARGE_BILL_MIN_AMOUNT),
          )}
        </p>
      </div>

      <ProvisionGroup language={language} provision={provision} />
    </section>
  );
}

function ProvisionGroup({
  language,
  provision,
}: {
  language: AppLanguage;
  provision: ProvisionPlan;
}) {
  return (
    <section className="mt-8 min-w-0" aria-labelledby="provision-title">
      <h3
        id="provision-title"
        className="app-plan-subsection-title px-1 text-[var(--app-text)]"
      >
        {t("insights.provision.title", language)}
      </h3>
      <p className="mt-1 px-1 text-sm text-[var(--app-text-muted)]">
        {t("insights.provision.subtitle", language)}
      </p>

      {provision.items.length ? (
        <>
          <div className="app-plan-equation-total mt-4 flex items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-accent)]">
              <PiggyBank size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="app-money text-lg font-semibold text-[var(--app-text)]">
                {t("insights.provision.headline", language).replace(
                  "{amount}",
                  formatCurrency(provision.monthlyTotal),
                )}
              </p>
              <p className="app-money text-xs text-[var(--app-text-muted)]">
                {t("insights.provision.perYear", language).replace(
                  "{amount}",
                  formatCurrency(provision.annualTotal),
                )}
              </p>
            </div>
          </div>
          <ul className="mt-2 grid gap-1">
            {provision.items.map((item) => (
              <li
                key={item.template.id}
                className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--app-radius-sm)] px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold text-[var(--app-text)]">
                    {item.template.name}
                  </span>
                  <span className="app-money block text-xs text-[var(--app-text-muted)]">
                    {item.next
                      ? t("insights.provision.next", language)
                          .replace("{date}", formatShortDate(item.next.dueDate, language))
                          .replace("{amount}", formatCurrency(item.next.amount))
                      : t("insights.provision.perYear", language).replace(
                          "{amount}",
                          formatCurrency(item.annual),
                        )}
                  </span>
                </span>
                <span className="app-money max-w-[9.5rem] shrink-0 text-right text-sm font-semibold leading-snug text-[var(--app-text)]">
                  {!item.next
                    ? t("insights.cost.perMonth", language).replace(
                        "{amount}",
                        formatCurrency(item.monthly),
                      )
                    : item.next.monthsUntil <= 1
                      ? t("insights.provision.dueThisMonth", language)
                      : t("insights.provision.untilThen", language).replace(
                          "{amount}",
                          formatCurrency(item.next.perMonthUntilDue),
                        )}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-4">
          <PlanEmptyLine>{t("insights.provision.empty", language)}</PlanEmptyLine>
        </div>
      )}
    </section>
  );
}
