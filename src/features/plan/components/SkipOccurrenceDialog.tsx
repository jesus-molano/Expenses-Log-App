import { Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";

type SkipOccurrenceDialogProps = {
  occurrence: ExpenseOccurrence | null;
  language: AppLanguage;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SkipOccurrenceDialog({
  occurrence,
  language,
  onCancel,
  onConfirm,
}: SkipOccurrenceDialogProps) {
  if (!occurrence) return null;

  return (
    <ConfirmActionDialog
      icon={<Trash2 size={18} />}
      title={t("money.skipMonthExpense", language)}
      body={`${t("money.skipMonthExpenseConfirm", language)} ${occurrence.template.name}`}
      cancelLabel={t("common.back", language)}
      confirmLabel={t("money.skipMonthExpenseAction", language)}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
