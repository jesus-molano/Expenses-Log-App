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

export type CaptureReason =
  | "missing_key"
  | "rate_limited"
  | "unauthenticated"
  | "auth_failed"
  | "model_unavailable"
  | "quota_exhausted"
  | "blocked"
  | "truncated"
  | "invalid_response"
  | "timeout"
  | "ai_unavailable"
  | "offline";

const REASON_LABELS: Record<CaptureReason, TranslationKey> = {
  missing_key: "expenses.aiNotConfigured",
  rate_limited: "expenses.aiRateLimited",
  unauthenticated: "expenses.aiRequiresLogin",
  auth_failed: "expenses.aiAuthFailed",
  model_unavailable: "expenses.aiModelUnavailable",
  quota_exhausted: "expenses.aiQuotaExhausted",
  blocked: "expenses.aiBlocked",
  truncated: "expenses.aiTruncated",
  invalid_response: "expenses.aiInvalidResponse",
  timeout: "expenses.aiTimeout",
  ai_unavailable: "expenses.aiUnavailable",
  offline: "expenses.aiOffline",
};

// Por qué se usó el análisis local en lugar de la IA.
export function captureReasonLabel(reason: CaptureReason | null, language: AppLanguage) {
  return t(reason ? REASON_LABELS[reason] : "expenses.aiLocal", language);
}
