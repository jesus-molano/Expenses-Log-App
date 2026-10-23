"use client";

import { Trash2, Undo2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type ExpenseDetailDialogsProps = {
  expenseName: string;
  language: AppLanguage;
  deleteOpen: boolean;
  discardOpen: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onKeepEditing: () => void;
  onDiscardChanges: () => void;
};

// Confirmaciones del detalle: borrar el gasto y salir sin guardar.
export function ExpenseDetailDialogs({
  expenseName,
  language,
  deleteOpen,
  discardOpen,
  onCancelDelete,
  onConfirmDelete,
  onKeepEditing,
  onDiscardChanges,
}: ExpenseDetailDialogsProps) {
  if (deleteOpen) {
    return (
      <ConfirmActionDialog
        icon={<Trash2 size={18} />}
        title={t("expenses.deleteTitle", language).replace("{name}", expenseName)}
        body={t("expenses.deleteBody", language)}
        cancelLabel={t("common.cancel", language)}
        confirmLabel={t("expenses.delete", language)}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    );
  }

  if (discardOpen) {
    return (
      <ConfirmActionDialog
        icon={<Undo2 size={18} />}
        title={t("expenses.discardChangesTitle", language).replace("{name}", expenseName)}
        body={t("expenses.discardChangesBody", language)}
        cancelLabel={t("expenses.keepEditing", language)}
        confirmLabel={t("expenses.discardChanges", language)}
        onCancel={onKeepEditing}
        onConfirm={onDiscardChanges}
      />
    );
  }

  return null;
}
