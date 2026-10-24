"use client";

import { useId } from "react";
import { TriangleAlert } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { capitalize, formatMonthName } from "@/features/expenses/lib/month-view";
import { formatMessage, t } from "@/shared/i18n";
import type { BillsCoverage } from "../lib/account-summary";
import { formatShortDate } from "../lib/plan-dashboard";

// Saldo de las cuentas de recibos frente a lo que queda por pagar en el mes
// activo: "Saldo X · quedan Y por pagar · te sobran Z" (o "te faltan").
export function BillsCoverageCard({
  coverage,
  monthId,
  language,
}: {
  coverage: BillsCoverage;
  monthId: string;
  language: AppLanguage;
}) {
  const titleId = useId();
  const pending = formatCurrency(coverage.pending);
  // Cuentas de recibos sin ningún saldo: no entran en la suma, y hay que
  // decirlo para que "te sobran" o "te faltan" no parezca de todas.
  const uncounted = coverage.accountCount - coverage.countedCount;

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="app-plan-metric-grid mt-4 min-w-0 rounded-[var(--app-radius-lg)] px-3 py-3"
    >
      <p id={titleId} className="break-words text-xs font-medium text-[var(--app-text-muted)]">
        {capitalize(
          formatMessage(
            "insights.accounts.bills.title",
            { month: formatMonthName(monthId, language) },
            language,
          ),
        )}
        {coverage.countedCount > 1
          ? ` · ${formatMessage(
              "insights.accounts.bills.accounts",
              { count: coverage.countedCount },
              language,
            )}`
          : null}
      </p>
      {coverage.balanceDate ? (
        <>
          <p className="app-money mt-1 break-words text-sm leading-relaxed text-[var(--app-text)]">
            {formatMessage(
              "insights.accounts.bills.balance",
              { amount: formatCurrency(coverage.balance) },
              language,
            )}
            {" · "}
            {formatMessage("insights.accounts.bills.pending", { amount: pending }, language)}
            {" · "}
            <BillsCoverageVerdict leftover={coverage.leftover} language={language} />
          </p>
          {uncounted > 0 ? (
            <p className="mt-1 break-words text-xs text-[var(--app-text-muted)]">
              {uncounted === 1
                ? t("insights.accounts.bills.uncountedOne", language)
                : formatMessage(
                    "insights.accounts.bills.uncountedMany",
                    { count: uncounted },
                    language,
                  )}
            </p>
          ) : null}
          {coverage.stale ? (
            <p className="mt-1 break-words text-xs text-[var(--app-text-muted)]">
              {formatMessage(
                "insights.accounts.bills.stale",
                { date: formatShortDate(coverage.balanceDate, language) },
                language,
              )}
            </p>
          ) : null}
        </>
      ) : (
        <p className="app-money mt-1 break-words text-sm text-[var(--app-text)]">
          {formatMessage("insights.accounts.bills.noBalance", { amount: pending }, language)}
        </p>
      )}
    </div>
  );
}

// "te sobran 200,00 €" en verde o "te faltan 150,00 €" en aviso, con su
// icono. La usan la tarjeta de Cuentas y la línea de Mes.
export function BillsCoverageVerdict({
  leftover,
  language,
  capitalized = false,
}: {
  leftover: number;
  language: AppLanguage;
  // Al empezar una frase: "Te sobran…".
  capitalized?: boolean;
}) {
  const short = leftover < 0;
  const text = formatMessage(
    short ? "insights.accounts.bills.shortfall" : "insights.accounts.bills.surplus",
    { amount: formatCurrency(Math.abs(leftover)) },
    language,
  );

  return (
    <span
      className={`font-semibold ${
        short ? "text-[var(--app-warning)]" : "text-[var(--app-success)]"
      }`}
    >
      {short ? (
        <TriangleAlert size={14} aria-hidden="true" className="mr-1 inline align-[-2px]" />
      ) : null}
      {capitalized ? capitalize(text) : text}
    </span>
  );
}
