import type { AppLanguage, PlanAccountPurpose } from "@/domain/types";
import {
  AccountPurposeIcon,
  accountPurposeLabel,
} from "@/features/plan/lib/account-purpose";
import { cn } from "@/shared/ui";

type AccountPurposeToggleProps = {
  purpose: PlanAccountPurpose;
  selected: boolean;
  language: AppLanguage;
  onClick: () => void;
};

export function AccountPurposeToggle({
  purpose,
  selected,
  language,
  onClick,
}: AccountPurposeToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-selected={selected}
      className={cn(
        "app-control inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-[var(--app-radius-sm)] px-2 text-xs font-bold",
        selected
          ? "text-[var(--app-accent-contrast)]"
          : "text-[var(--app-text-muted)]",
      )}
    >
      <AccountPurposeIcon purpose={purpose} size={14} />
      <span className="truncate">{accountPurposeLabel(purpose, language)}</span>
    </button>
  );
}
