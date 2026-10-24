import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence, MonthlyMoneyPlan } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";

// Recibos del mes que se mira para la lista plegable de Mes: sin los quitados
// del mes y con los pendientes primero (cada grupo, en su orden de fechas).
export function monthReceipts(occurrences: ExpenseOccurrence[]) {
  const listed = occurrences.filter((occurrence) => occurrence.status !== "skipped");
  const pending = listed.filter((occurrence) => occurrence.status === "due");
  return {
    items: [...pending, ...listed.filter((occurrence) => occurrence.status !== "due")],
    pendingCount: pending.length,
  };
}

// Resumen de la lista plegada: "4 pendientes · 343,81 €", "Todo pagado ·
// 120,00 €" o que no hay recibos. El importe pendiente es el "Por pagar" del
// plan, el mismo que la cabecera de Gastos.
export function monthReceiptsSummary(
  pendingCount: number,
  plan: Pick<
    MonthlyMoneyPlan,
    "plannedExpenseCount" | "pendingExpensesTotal" | "paidExpensesTotal"
  >,
  language: AppLanguage,
) {
  if (pendingCount > 0) {
    return formatMessage(
      pendingCount === 1 ? "plan.receiptsPendingOne" : "plan.receiptsPendingMany",
      { count: pendingCount, amount: formatCurrency(plan.pendingExpensesTotal) },
      language,
    );
  }
  if (plan.plannedExpenseCount === 0) return t("plan.noReceipts", language);
  return formatMessage(
    "plan.receiptsAllPaid",
    { amount: formatCurrency(plan.paidExpensesTotal) },
    language,
  );
}
