import { daysBetween, normalizeDateOnly } from "./calendar";
import type { ExpenseDetails, PaymentMethod } from "./types";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "card",
  "direct_debit",
  "transfer",
  "cash",
  "bizum",
  "paypal",
  "other",
];

export const EXPENSE_NOTES_MAX_LENGTH = 1000;
export const PAYMENT_METHOD_DETAIL_MAX_LENGTH = 40;
export const CANCELLATION_URL_MAX_LENGTH = 500;
// Días antes del fin de la permanencia en que se avisa de que se acaba.
export const COMMITMENT_HINT_DAYS = 30;

export const EXPENSE_DETAIL_KEYS = [
  "notes",
  "cancellationUrl",
  "commitmentEndDate",
  "paymentMethod",
  "paymentMethodDetail",
] as const satisfies ReadonlyArray<keyof ExpenseDetails>;

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

// Enlace de baja utilizable o undefined. Solo http(s), para que nunca se abra
// un `javascript:` o similar; "netflix.com/cancel" se completa con https://.
export function normalizeCancellationUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CANCELLATION_URL_MAX_LENGTH || /\s/.test(trimmed)) {
    return undefined;
  }
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  // Sin esquema solo se acepta algo con forma de dominio ("x.com/...").
  if (!hasScheme && !/^[\p{L}\d-]+(\.[\p{L}\d-]+)+([/?#:]|$)/u.test(trimmed)) {
    return undefined;
  }
  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

// Lo que el usuario escribió en el campo de baja es válido (vacío también).
export function isValidCancellationUrlInput(value: string) {
  return value.trim() === "" || normalizeCancellationUrl(value) !== undefined;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLength).trim();
  return trimmed || undefined;
}

// Solo los datos válidos: lo vacío o ilegible se descarta en lugar de romper
// el gasto. Sirve para la normalización del store y para guardar el
// formulario.
export function sanitizeExpenseDetails(raw: Partial<Record<keyof ExpenseDetails, unknown>>): ExpenseDetails {
  const paymentMethod = isPaymentMethod(raw.paymentMethod) ? raw.paymentMethod : undefined;
  const details: ExpenseDetails = {
    notes: cleanText(raw.notes, EXPENSE_NOTES_MAX_LENGTH),
    cancellationUrl: normalizeCancellationUrl(raw.cancellationUrl),
    commitmentEndDate:
      typeof raw.commitmentEndDate === "string"
        ? normalizeDateOnly(raw.commitmentEndDate)
        : undefined,
    paymentMethod,
    // El detalle sin método no se puede mostrar: se guarda como "otro".
    paymentMethodDetail: cleanText(raw.paymentMethodDetail, PAYMENT_METHOD_DETAIL_MAX_LENGTH),
  };
  if (details.paymentMethodDetail && !details.paymentMethod) details.paymentMethod = "other";

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  ) as ExpenseDetails;
}

export type CommitmentStatus = {
  // active: falta más de COMMITMENT_HINT_DAYS; ending: se acaba pronto;
  // ended: ya se puede dar de baja sin penalización.
  kind: "active" | "ending" | "ended";
  endDate: string;
  daysLeft: number;
};

export function commitmentStatus(
  commitmentEndDate: string | undefined,
  today: string,
): CommitmentStatus | null {
  const endDate = normalizeDateOnly(commitmentEndDate);
  if (!endDate) return null;
  const daysLeft = daysBetween(today, endDate);
  return {
    kind: daysLeft < 0 ? "ended" : daysLeft <= COMMITMENT_HINT_DAYS ? "ending" : "active",
    endDate,
    daysLeft,
  };
}
