import { Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";

type RemoveIncomeDialogProps = {
  incomeEvent: IncomeEvent | null;
  language: AppLanguage;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveIncomeDialog({
  incomeEvent,
  language,
  onCancel,
  onConfirm,
}: RemoveIncomeDialogProps) {
  if (!incomeEvent) return null;

  return (
    <ConfirmActionDialog
      icon={<Trash2 size={18} />}
      title={t("money.removeIncomeTitle", language).replace("{name}", incomeEvent.name)}
      body={t("money.removeIncomeBody", language)}
      cancelLabel={t("common.cancel", language)}
      confirmLabel={t("money.removeIncomeAction", language)}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
