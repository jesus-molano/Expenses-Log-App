import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import { accountDisplayName, accountRoleLabel } from "./account-labels";
import type { AccountSummary, BillsCoverage } from "./account-summary";

// A quién se refiere "te sobran": el nombre de la cuenta de recibos que se
// suma (la única de recibos si ninguna tiene saldo) o, si son varias,
// "Recibos".
export function billsAccountLabel(summaries: AccountSummary[], language: AppLanguage) {
  const bills = summaries.filter((summary) => summary.account.role === "bills");
  const counted = bills.filter((summary) => summary.trend);
  const named = counted.length ? counted : bills;
  return named.length === 1
    ? accountDisplayName(named[0].account, language)
    : accountRoleLabel("bills", language);
}

// Cabecera de Cuentas: si la cuenta de recibos llega a lo que queda por pagar
// ("Te sobran · Sabadell"); sin saldo en ella, la suma del último saldo de
// cada cuenta; y sin ningún saldo, un título neutro.
export function accountsHeadline(
  summaries: AccountSummary[],
  coverage: BillsCoverage | null,
  language: AppLanguage,
): { title: string; label: string } {
  if (coverage && coverage.countedCount > 0) {
    const account = billsAccountLabel(summaries, language);
    return {
      title: formatMessage(
        coverage.leftover < 0
          ? "insights.accounts.headline.shortfall"
          : "insights.accounts.headline.surplus",
        { account },
        language,
      ),
      label: formatCurrency(Math.abs(coverage.leftover)),
    };
  }
  const latest = summaries.flatMap((summary) =>
    summary.trend ? [summary.trend.latest.amount] : [],
  );
  if (latest.length) {
    const total = Math.round(latest.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
    return {
      title: t("insights.accounts.headline.total", language),
      label: formatCurrency(total),
    };
  }
  // Sin saldos no hay cifra que dar: una raya en lugar de un 0,00 € falso.
  return { title: t("insights.accounts.headline.empty", language), label: "—" };
}
