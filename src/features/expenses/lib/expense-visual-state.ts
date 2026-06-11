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
    paid: "border-[color-mix(in_srgb,var(--app-success)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-success)_8%,var(--app-surface))]",
    overdue:
      "border-[color-mix(in_srgb,var(--app-danger)_24%,transparent)] bg-[color-mix(in_srgb,var(--app-danger)_9%,var(--app-surface))]",
    estimated:
      "border-[color-mix(in_srgb,var(--app-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--app-warning)_9%,var(--app-surface))]",
    pending:
      "border-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-surface))] shadow-[0_10px_28px_rgba(0,0,0,0.18)]",
  }[state];
}

export function expenseStatusToneClass(
  occurrence: ExpenseOccurrence,
  today: string,
) {
  const state = resolveExpenseVisualState(occurrence, today);

  return {
    paid: "bg-[color-mix(in_srgb,var(--app-success)_14%,transparent)] text-[var(--app-success)]",
    overdue:
      "bg-[color-mix(in_srgb,var(--app-danger)_14%,transparent)] text-[var(--app-danger)]",
    estimated:
      "bg-[color-mix(in_srgb,var(--app-warning)_15%,transparent)] text-[var(--app-warning)]",
    pending:
      "bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[color-mix(in_srgb,var(--app-accent)_78%,var(--app-text))]",
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
