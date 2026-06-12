"use client";

import type { AccountAllocation } from "@/domain/finance";
import type { AppLanguage } from "@/domain/types";
import { AccountAllocationCard } from "@/features/plan/components/accounts/AccountAllocationCard";
import { t } from "@/shared/i18n";

type AccountAllocationCardsProps = {
  language: AppLanguage;
  allocations: AccountAllocation[];
};

export function AccountAllocationCards({
  language,
  allocations,
}: AccountAllocationCardsProps) {
  return (
    <section className="grid min-w-0 gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--app-text)]">
          {t("money.accounts", language)}
        </h2>
      </header>
      <div
        className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
        aria-label={t("money.accounts", language)}
      >
        {allocations.map((allocation) => (
          <AccountAllocationCard
            key={allocation.account.id}
            allocation={allocation}
            language={language}
          />
        ))}
      </div>
    </section>
  );
}
