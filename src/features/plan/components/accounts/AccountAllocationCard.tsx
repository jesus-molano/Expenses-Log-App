import { formatCurrency } from "@/domain/calendar";
import type { AccountAllocation } from "@/domain/finance";
import type { AppLanguage } from "@/domain/types";
import { AccountPurposeIcon } from "@/features/plan/lib/account-purpose";
import { AccountPurposeChip } from "./AccountPurposeChip";

type AccountAllocationCardProps = {
  allocation: AccountAllocation;
  language: AppLanguage;
};

export function AccountAllocationCard({
  allocation,
  language,
}: AccountAllocationCardProps) {
  const visiblePurposes = allocation.purposes.length
    ? allocation.purposes
    : [
        {
          purpose: allocation.leadPurpose,
          amount: 0,
          contributesAmount: false,
        },
      ];

  return (
    <article className="app-entity-card p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="app-icon-badge size-9 shrink-0 text-[var(--app-accent)]">
          <AccountPurposeIcon purpose={allocation.leadPurpose} size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-sm font-bold text-[var(--app-text)]">
            {allocation.account.name}
          </p>

          {allocation.isConsolidated ? null : (
            <div className="mt-1.5 flex min-w-0 flex-wrap gap-1">
              {visiblePurposes.map((purpose) => (
                <AccountPurposeChip
                  key={purpose.purpose}
                  purpose={purpose.purpose}
                  muted={!purpose.contributesAmount}
                  language={language}
                />
              ))}
            </div>
          )}
        </div>

        {allocation.showAmount ? (
          <p className="shrink-0 text-right text-base font-semibold leading-tight text-[var(--app-text)]">
            {formatCurrency(allocation.assignedAmount)}
          </p>
        ) : null}
      </div>
    </article>
  );
}
