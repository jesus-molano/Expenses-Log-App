import type { CategoryNameError } from "@/domain/categories";
import type { CommitmentStatus } from "@/domain/expense-details";
import type { AppLanguage, CategoryTone, PaymentMethod } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";
import { formatRecurringDate } from "./recurring-overview-format";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, TranslationKey> = {
  card: "expenseDetails.methodCard",
  direct_debit: "expenseDetails.methodDirectDebit",
  transfer: "expenseDetails.methodTransfer",
  cash: "expenseDetails.methodCash",
  bizum: "expenseDetails.methodBizum",
  paypal: "expenseDetails.methodPaypal",
  other: "expenseDetails.methodOther",
};

// "Tarjeta · Visa ···4321", o solo el detalle si el método es "otro".
export function paymentMethodLabel(
  method: PaymentMethod | undefined,
  detail: string | undefined,
  language: AppLanguage,
) {
  if (!method) return "";
  if (method === "other" && detail) return detail;
  const label = t(PAYMENT_METHOD_LABELS[method], language);
  return detail ? `${label} · ${detail}` : label;
}

export function paymentMethodName(method: PaymentMethod, language: AppLanguage) {
  return t(PAYMENT_METHOD_LABELS[method], language);
}

export function commitmentLabel(status: CommitmentStatus, language: AppLanguage) {
  const date = formatRecurringDate(status.endDate, language);
  if (status.kind === "ended") {
    return t("expenseDetails.commitmentEnded", language).replace("{date}", date);
  }
  if (status.kind === "active") {
    return t("expenseDetails.commitmentActive", language).replace("{date}", date);
  }
  if (status.daysLeft === 0) return t("expenseDetails.commitmentEndingToday", language);
  if (status.daysLeft === 1) {
    return t("expenseDetails.commitmentEndingOne", language).replace("{date}", date);
  }
  return t("expenseDetails.commitmentEnding", language)
    .replace("{days}", String(status.daysLeft))
    .replace("{date}", date);
}

const TONE_LABELS: Record<CategoryTone, TranslationKey> = {
  blue: "categoryManager.toneBlue",
  green: "categoryManager.toneGreen",
  orange: "categoryManager.toneOrange",
  rose: "categoryManager.toneRose",
  violet: "categoryManager.toneViolet",
  slate: "categoryManager.toneSlate",
};

export function categoryToneLabel(tone: CategoryTone, language: AppLanguage) {
  return t(TONE_LABELS[tone], language);
}

const NAME_ERRORS: Record<CategoryNameError, TranslationKey> = {
  empty: "categoryManager.errorEmpty",
  tooLong: "categoryManager.errorTooLong",
  duplicate: "categoryManager.errorDuplicate",
};

export function categoryNameErrorLabel(error: CategoryNameError, language: AppLanguage) {
  return t(NAME_ERRORS[error], language);
}

// "3 gastos", "1 gasto" o "Sin gastos".
export function categoryUsageLabel(count: number, language: AppLanguage) {
  if (count === 0) return t("categoryManager.usageNone", language);
  if (count === 1) return t("categoryManager.usageOne", language);
  return t("categoryManager.usageMany", language).replace("{count}", String(count));
}
