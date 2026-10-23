import type { CaptureField } from "@/domain/expense-capture";
import type { AppLanguage } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";

const FIELD_LABELS: Record<CaptureField, TranslationKey> = {
  amount: "expenses.captureFieldAmount",
  dueDay: "expenses.captureFieldDueDay",
  startDate: "expenses.captureFieldStartDate",
  categoryName: "expenses.captureFieldCategoryName",
  frequency: "expenses.captureFieldFrequency",
};

// "Revisa: fecha, categoría" para lo que la captura dedujo; vacío si nada.
export function inferredFieldsLabel(fields: CaptureField[], language: AppLanguage) {
  if (!fields.length) return "";
  return t("expenses.captureReview", language).replace(
    "{fields}",
    fields.map((field) => t(FIELD_LABELS[field], language)).join(", "),
  );
}
