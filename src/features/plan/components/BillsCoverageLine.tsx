import { Landmark } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { appTabHref } from "@/shared/app-tabs";
import { formatMessage } from "@/shared/i18n";
import type { BillsCoverage } from "../lib/account-summary";
import { BillsCoverageVerdict } from "./BillsCoverageCard";
import { PlanActionRow } from "./PlanActionRow";

// Línea corta de Mes con lo que dice la tarjeta de Cuentas: si la cuenta de
// recibos llega a lo que queda por pagar. Lleva a la pestaña Cuentas.
export function BillsCoverageLine({
  coverage,
  accountLabel,
  language,
}: {
  coverage: BillsCoverage;
  // Nombre de la cuenta de recibos, o "Recibos" si se suman varias.
  accountLabel: string;
  language: AppLanguage;
}) {
  return (
    <div className="app-plan-actions rounded-[var(--app-radius-lg)] p-1">
      <PlanActionRow
        href={appTabHref("accounts")}
        icon={<Landmark size={17} aria-hidden="true" />}
        label={accountLabel}
        detail={
          coverage.countedCount > 0 ? (
            <BillsCoverageVerdict leftover={coverage.leftover} language={language} capitalized />
          ) : (
            formatMessage(
              "insights.accounts.bills.noBalance",
              { amount: formatCurrency(coverage.pending) },
              language,
            )
          )
        }
      />
    </div>
  );
}
