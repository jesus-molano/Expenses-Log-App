"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage, PlanAccount } from "@/domain/types";
import { PlanAccountConfigCard } from "@/features/plan/components/accounts/PlanAccountConfigCard";
import { usePlanAccountEditor } from "@/features/plan/hooks/use-plan-account-editor";
import { t } from "@/shared/i18n";

type PlanAccountFieldsProps = {
  language: AppLanguage;
  accounts: PlanAccount[];
  onAccountsChange: (value: PlanAccount[]) => void;
};

export function PlanAccountFields({
  language,
  accounts,
  onAccountsChange,
}: PlanAccountFieldsProps) {
  const editor = usePlanAccountEditor({ accounts, onAccountsChange });

  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">
          {t("money.accounts", language)}
        </h3>
        <Button
          type="button"
          onClick={editor.addAccount}
          disabled={!editor.canAddAccount}
          variant="secondary"
          size="sm"
          leadingIcon={<Plus size={16} />}
        >
          {t("money.addAccount", language)}
        </Button>
      </div>

      {accounts.map((account, index) => (
        <PlanAccountConfigCard
          key={account.id}
          account={account}
          index={index}
          language={language}
          canRemove={editor.canRemoveAccount}
          onRename={editor.renameAccount}
          onRemove={editor.removeAccount}
          onTogglePurpose={editor.togglePurpose}
        />
      ))}
    </div>
  );
}
