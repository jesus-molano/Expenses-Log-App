import { X } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { PLAN_ACCOUNT_NAME_MAX_LENGTH } from "@/domain/plan-accounts";
import type { AppLanguage, PlanAccount, PlanAccountPurpose } from "@/domain/types";
import { PLAN_ACCOUNT_PURPOSES } from "@/features/plan/lib/account-purpose";
import { t } from "@/shared/i18n";
import { AccountPurposeToggle } from "./AccountPurposeToggle";

type PlanAccountConfigCardProps = {
  account: PlanAccount;
  index: number;
  language: AppLanguage;
  canRemove: boolean;
  onRename: (account: PlanAccount, name: string) => void;
  onRemove: (accountId: string) => void;
  onTogglePurpose: (
    account: PlanAccount,
    purpose: PlanAccountPurpose,
  ) => void;
};

export function PlanAccountConfigCard({
  account,
  index,
  language,
  canRemove,
  onRename,
  onRemove,
  onTogglePurpose,
}: PlanAccountConfigCardProps) {
  return (
    <div className="app-section-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--app-text-subtle)]">
          {t("money.accountLabel", language)} {index + 1}
        </p>
        <IconButton
          type="button"
          onClick={() => onRemove(account.id)}
          disabled={!canRemove}
          aria-label={t("money.removeAccount", language)}
          variant="ghost"
          size="sm"
        >
          <X size={15} />
        </IconButton>
      </div>

      <div className="grid gap-2">
        <Field label={t("money.accountName", language)}>
          <input
            value={account.name}
            maxLength={PLAN_ACCOUNT_NAME_MAX_LENGTH}
            onChange={(event) => onRename(account, event.target.value)}
            className="input-control"
          />
        </Field>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {PLAN_ACCOUNT_PURPOSES.map((purpose) => (
            <AccountPurposeToggle
              key={purpose}
              purpose={purpose}
              selected={account.purposes.includes(purpose)}
              language={language}
              onClick={() => onTogglePurpose(account, purpose)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
