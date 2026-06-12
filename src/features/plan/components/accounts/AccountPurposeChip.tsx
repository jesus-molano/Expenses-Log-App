import type { AppLanguage, PlanAccountPurpose } from "@/domain/types";
import {
  AccountPurposeIcon,
  accountPurposeLabel,
} from "@/features/plan/lib/account-purpose";
import { cn } from "@/shared/ui";

type AccountPurposeChipProps = {
  purpose: PlanAccountPurpose;
  muted?: boolean;
  language: AppLanguage;
};

export function AccountPurposeChip({
  purpose,
  muted = false,
  language,
}: AccountPurposeChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold",
        muted
          ? "bg-[var(--app-panel-soft-alpha)] text-[var(--app-text-subtle)]"
          : "bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]",
      )}
    >
      <AccountPurposeIcon purpose={purpose} size={11} />
      <span className="truncate">{accountPurposeLabel(purpose, language)}</span>
    </span>
  );
}
