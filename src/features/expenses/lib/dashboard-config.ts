import { toDateOnly } from "@/domain/calendar";
import type { DraftExpense } from "@/domain/types";

export function createEmptyDraft(): DraftExpense {
  const today = new Date();

  return {
    name: "",
    description: "",
    amount: 1,
    categoryName: "General",
    startDate: toDateOnly(today),
    dueDay: today.getDate(),
    recurrence: { frequency: "monthly" },
  };
}
