import type { ExpenseOccurrence } from "@/domain/types";

export type ExpenseVisualState = "paid" | "overdue" | "estimated" | "pending";

export function resolveExpenseVisualState(
  occurrence: ExpenseOccurrence,
  today: string,
): ExpenseVisualState {
  if (occurrence.status === "paid") return "paid";
  if (occurrence.dueDate < today) return "overdue";
  if (occurrence.estimatedChargeDate !== occurrence.dueDate) return "estimated";
  return "pending";
}

export function expenseRowToneClass(
  occurrence: ExpenseOccurrence,
  today: string,
) {
  const state = resolveExpenseVisualState(occurrence, today);

  return {
    paid: "app-row-card-paid",
    overdue: "app-row-card-overdue",
    estimated: "app-row-card-estimated",
    pending: "app-row-card",
  }[state];
}

export function expenseStatusToneClass(
  occurrence: ExpenseOccurrence,
  today: string,
) {
  const state = resolveExpenseVisualState(occurrence, today);

  return {
    paid: "app-status-paid",
    overdue: "app-status-overdue",
    estimated: "app-status-estimated",
    pending: "app-status-pending",
  }[state];
}

export function timelineDotToneClass(state: ExpenseVisualState) {
  return {
    paid: "app-timeline-dot-paid",
    overdue: "app-timeline-dot-critical",
    estimated: "app-timeline-dot-estimated",
    pending: "",
  }[state];
}
