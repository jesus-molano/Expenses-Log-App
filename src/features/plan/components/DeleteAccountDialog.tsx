import { Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import type { AppLanguage } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import { accountDisplayName } from "../lib/account-labels";
import type { AccountSummary } from "../lib/account-summary";

// Confirmación antes de borrar una cuenta con todos sus saldos.
export function DeleteAccountDialog({
  summary,
  language,
  onCancel,
  onConfirm,
}: {
  summary: AccountSummary | null;
  language: AppLanguage;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!summary) return null;
  const count = summary.entries.length;

  return (
    <ConfirmActionDialog
      icon={<Trash2 size={18} />}
      title={formatMessage(
        "insights.accounts.deleteTitle",
        { name: accountDisplayName(summary.account, language) },
        language,
      )}
      body={
        count === 0
          ? t("insights.accounts.deleteBodyNone", language)
          : count === 1
            ? t("insights.accounts.deleteBodyOne", language)
            : formatMessage("insights.accounts.deleteBodyMany", { count }, language)
      }
      cancelLabel={t("common.cancel", language)}
      confirmLabel={t("insights.accounts.delete", language)}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
