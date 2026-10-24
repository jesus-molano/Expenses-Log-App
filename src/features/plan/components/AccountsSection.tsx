import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  accountInsight,
  type AccountSummary,
  type BillsCoverage,
} from "../lib/account-summary";
import type { BalanceEntry } from "../lib/balance-log";
import { AccountCard } from "./AccountCard";
import { BillsCoverageCard } from "./BillsCoverageCard";
import { PlanEmptyLine } from "./PlanSectionList";

// Cuentas del banco: el saldo de cada una y, para las de recibos, si llega a
// lo que queda por pagar este mes.
export function AccountsSection({
  language,
  monthId,
  summaries,
  coverage,
  savingsTarget,
  onAdd,
  onRecord,
  onEdit,
  onMove,
  onDeleteEntry,
}: {
  language: AppLanguage;
  // Mes activo.
  monthId: string;
  summaries: AccountSummary[];
  coverage: BillsCoverage | null;
  savingsTarget: number;
  onAdd: () => void;
  onRecord: (accountId: string) => void;
  onEdit: (accountId: string) => void;
  onMove: (accountId: string, direction: -1 | 1) => void;
  onDeleteEntry: (accountId: string, entry: BalanceEntry) => void;
}) {
  const addButton = (
    <Button
      size="sm"
      variant="soft"
      className="shrink-0"
      leadingIcon={<Plus size={16} aria-hidden="true" />}
      onClick={onAdd}
    >
      {t("insights.accounts.add", language)}
    </Button>
  );

  return (
    <section className="min-w-0" aria-labelledby="accounts-title">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="accounts-title" className="app-plan-section-title text-[var(--app-text)]">
            {t("insights.accounts.title", language)}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {t("insights.accounts.subtitle", language)}
          </p>
        </div>
        {summaries.length ? addButton : null}
      </header>

      {summaries.length ? (
        <>
          {coverage ? (
            <BillsCoverageCard coverage={coverage} monthId={monthId} language={language} />
          ) : null}
          <ul className="mt-4 grid gap-3">
            {summaries.map((summary, index) => (
              <li key={summary.account.id} className="min-w-0">
                <AccountCard
                  summary={summary}
                  insight={accountInsight(summary, { savingsTarget })}
                  monthId={monthId}
                  language={language}
                  position={index}
                  showReorder={summaries.length > 1}
                  canMoveUp={index > 0}
                  canMoveDown={index < summaries.length - 1}
                  onRecord={() => onRecord(summary.account.id)}
                  onEdit={() => onEdit(summary.account.id)}
                  onMove={(direction) => onMove(summary.account.id, direction)}
                  onDeleteEntry={(entry) => onDeleteEntry(summary.account.id, entry)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-4 grid justify-items-start gap-3">
          <div className="w-full">
            <PlanEmptyLine>{t("insights.accounts.empty", language)}</PlanEmptyLine>
          </div>
          {addButton}
        </div>
      )}
    </section>
  );
}
